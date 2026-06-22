import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useThemeStore, useColors } from '../../stores/themeStore';
import { casesApi, documentsApi } from '../../services/api';
import { Document } from '../../types';
import { formatErrorMessage } from '../../utils/formatError';

// Two route shapes are supported:
//   1. Legacy case-scoped:   { caseId, document }         — uses casesApi.*
//   2. Generic per-document: { documentId, document?, contextLabel? }  — uses documentsApi.*
//
// The generic shape works for case docs, appointment docs, and chat
// attachments uniformly because the server's /documents/:id/* routes walk
// the document's parent (case / appointment / chat) for permission.
export const DocumentAiScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { caseId, document, documentId, contextLabel } = route.params || {};
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [activeTab, setActiveTab] = useState<'content' | 'summary' | 'ask'>('content');
  // Route may pass a partial doc OR none at all (if we only have its id).
  // We synthesise a placeholder so the screen renders before the first
  // extract / fetch returns.
  const initialDocId: string = (document?.id as string) || (documentId as string) || '';
  const [doc, setDoc] = useState<Document>(
    (document as Document) || ({ id: initialDocId, extractionStatus: 'NOT_STARTED' } as any),
  );

  const useGeneric = !caseId; // generic route when no caseId present

  // Extract
  const [extracting, setExtracting] = useState(false);
  // Summarize
  const [summarizing, setSummarizing] = useState(false);
  // Ask
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [qaHistory, setQaHistory] = useState<{ q: string; a: string }[]>([]);

  // Periodically check if processing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (doc.extractionStatus === 'PROCESSING') {
      interval = setInterval(fetchDocument, 3000);
    }
    return () => clearInterval(interval);
  }, [doc.extractionStatus]);

  const fetchDocument = async () => {
    if (useGeneric) {
      // No bulk-doc endpoint in generic mode — re-run extract to re-poll
      // status. This is the same approach the server returns: extract is
      // idempotent and returns the latest snapshot.
      try {
        const { data } = await documentsApi.extract(doc.id);
        const updated = data?.document;
        if (updated) {
          setDoc((prev) => ({ ...prev, ...updated }));
          if (updated.extractionStatus === 'COMPLETED') setExtracting(false);
        }
      } catch {}
      return;
    }
    try {
      const { data } = await casesApi.getDocuments(caseId);
      const docs = data.documents || data.items || data || [];
      const updatedDoc = docs.find((d: any) => d.id === doc.id);
      if (updatedDoc) {
        setDoc(updatedDoc);
        if (updatedDoc.extractionStatus === 'COMPLETED') {
          setExtracting(false);
        }
      }
    } catch {}
  };

  const handleExtract = async () => {
    try {
      setExtracting(true);
      if (useGeneric) {
        const { data } = await documentsApi.extract(doc.id);
        const updated = data?.document;
        if (updated) {
          setDoc((prev) => ({ ...prev, ...updated }));
          if (updated.extractionStatus === 'COMPLETED') setExtracting(false);
        } else {
          fetchDocument();
        }
      } else {
        await casesApi.extractText(caseId, doc.id);
        fetchDocument();
      }
      Alert.alert('Processing Started', 'The document text is being extracted. This might take a few moments.');
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to start extraction');
      setExtracting(false);
    }
  };

  const handleSummarize = async () => {
    try {
      setSummarizing(true);
      const { data } = useGeneric
        ? await documentsApi.summarize(doc.id)
        : await casesApi.summarize(caseId, doc.id);
      if (data?.summary) {
        setDoc((prev) => ({ ...prev, summary: data.summary }));
      } else {
        fetchDocument();
      }
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to summarize document');
    } finally {
      setSummarizing(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    const q = question.trim();
    setQuestion('');
    setAsking(true);
    setQaHistory(prev => [...prev, { q, a: '...' }]);

    try {
      const { data } = useGeneric
        ? await documentsApi.ask(doc.id, q)
        : await casesApi.askQuestion(caseId, doc.id, q);
      setQaHistory(prev => prev.map((item, idx) =>
        idx === prev.length - 1 ? { q, a: data.answer || 'No answer provided.' } : item
      ));
    } catch (err: any) {
      setQaHistory(prev => prev.map((item, idx) =>
        idx === prev.length - 1 ? { q, a: `Error: ${formatErrorMessage(err)}` } : item
      ));
    } finally {
      setAsking(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Document AI</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {(doc as any).filename || doc.fileName || doc.name || 'Document'}
            {contextLabel ? ` · ${contextLabel}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'content' && styles.activeTab]} onPress={() => setActiveTab('content')}>
          <Ionicons name="document-text" size={18} color={activeTab === 'content' ? COLORS.primary : COLORS.textMuted} />
          <Text style={[styles.tabText, activeTab === 'content' && styles.activeTabText]}>Extract</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'summary' && styles.activeTab]} onPress={() => setActiveTab('summary')}>
          <Ionicons name="flash" size={18} color={activeTab === 'summary' ? COLORS.primary : COLORS.textMuted} />
          <Text style={[styles.tabText, activeTab === 'summary' && styles.activeTabText]}>Summary</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'ask' && styles.activeTab]} onPress={() => setActiveTab('ask')}>
          <Ionicons name="chatbubbles" size={18} color={activeTab === 'ask' ? COLORS.primary : COLORS.textMuted} />
          <Text style={[styles.tabText, activeTab === 'ask' && styles.activeTabText]}>Ask AI</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.contentArea} keyboardShouldPersistTaps="handled">
        {/* CONTENT TAB */}
        {activeTab === 'content' && (
          <View>
            {!doc.extractedText && doc.extractionStatus !== 'PROCESSING' && doc.extractionStatus !== 'COMPLETED' ? (
              <View style={styles.emptyState}>
                <Ionicons name="scan-outline" size={48} color={COLORS.primary} style={{ marginBottom: SPACING.md }} />
                <Text style={styles.emptyTitle}>Extract Document Text</Text>
                <Text style={styles.emptySubtitle}>Use AI to extract text from this document for search and analysis.</Text>
                <TouchableOpacity style={styles.actionBtn} onPress={handleExtract} disabled={extracting}>
                  {extracting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.actionBtnText}>Start Extraction</Text>}
                </TouchableOpacity>
              </View>
            ) : doc.extractionStatus === 'PROCESSING' || extracting ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginBottom: SPACING.md }} />
                <Text style={styles.emptyTitle}>Processing Document...</Text>
                <Text style={styles.emptySubtitle}>This might take a minute.</Text>
              </View>
            ) : doc.extractionStatus === 'FAILED' ? (
              <View style={styles.emptyState}>
                <Ionicons name="warning" size={48} color={COLORS.error} style={{ marginBottom: SPACING.md }} />
                <Text style={[styles.emptyTitle, { color: COLORS.error }]}>Extraction Failed</Text>
                <Text style={styles.emptySubtitle}>{doc.extractionError || 'An error occurred while processing.'}</Text>
                <TouchableOpacity style={styles.actionBtn} onPress={handleExtract}>
                  <Text style={styles.actionBtnText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.textContainer}>
                <Text style={styles.extractedText}>{doc.extractedText}</Text>
              </View>
            )}
          </View>
        )}

        {/* SUMMARY TAB */}
        {activeTab === 'summary' && (
          <View>
            {!doc.summary ? (
               <View style={styles.emptyState}>
                 <Ionicons name="flash-outline" size={48} color={COLORS.primary} style={{ marginBottom: SPACING.md }} />
                 <Text style={styles.emptyTitle}>Generate Summary</Text>
                 <Text style={styles.emptySubtitle}>Get a quick AI-generated summary of the key points in this document.</Text>
                 <TouchableOpacity style={styles.actionBtn} onPress={handleSummarize} disabled={summarizing}>
                   {summarizing ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.actionBtnText}>Summarize Document</Text>}
                 </TouchableOpacity>
                 {doc.extractionStatus !== 'COMPLETED' && (
                   <Text style={[styles.emptySubtitle, { color: COLORS.error, marginTop: SPACING.lg }]}>Note: Text extraction should be completed first.</Text>
                 )}
               </View>
            ) : (
              <View style={styles.summaryContainer}>
                <View style={styles.summaryHeader}>
                  <Ionicons name="flash" size={20} color={COLORS.primary} />
                  <Text style={styles.summaryTitle}>AI Summary</Text>
                </View>
                <Text style={styles.summaryText}>{doc.summary}</Text>
              </View>
            )}
          </View>
        )}

        {/* ASK TAB */}
        {activeTab === 'ask' && (
          <View style={styles.chatArea}>
            {qaHistory.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={48} color={COLORS.primary} style={{ marginBottom: SPACING.md }} />
                <Text style={styles.emptyTitle}>Ask Document AI</Text>
                <Text style={styles.emptySubtitle}>Ask questions about the contents of this document.</Text>
                {doc.extractionStatus !== 'COMPLETED' && (
                   <Text style={[styles.emptySubtitle, { color: COLORS.error, marginTop: SPACING.lg }]}>Note: Text extraction should be completed first.</Text>
                )}
              </View>
            ) : (
              qaHistory.map((item, index) => (
                <View key={index} style={styles.qaItem}>
                  <View style={styles.questionBubble}>
                    <Text style={styles.questionText}>{item.q}</Text>
                  </View>
                  <View style={styles.answerBubble}>
                    {item.a === '...' ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Text style={styles.answerText}>{item.a}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Ask Input Area */}
      {activeTab === 'ask' && (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ask a question about this document..."
            placeholderTextColor={COLORS.textMuted}
            value={question}
            onChangeText={setQuestion}
            multiline
            maxLength={500}
            editable={!asking}
          />
          <TouchableOpacity 
            style={[styles.sendBtn, (!question.trim() || asking) && styles.sendBtnDisabled]} 
            onPress={handleAsk}
            disabled={!question.trim() || asking}
          >
            <Ionicons name="send" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm, zIndex: 10
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '900', color: COLORS.text },
  headerSubtitle: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  
  tabContainer: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.lg, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textMuted },
  activeTabText: { color: COLORS.primary, fontWeight: '700' },
  
  contentArea: { padding: SPACING.xl, paddingBottom: 100 },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxl * 2 },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.sm, textAlign: 'center' },
  emptySubtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: SPACING.xl, lineHeight: 20 },
  
  actionBtn: {
    backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl, marginTop: SPACING.xl, minWidth: 200, alignItems: 'center',
    ...SHADOWS.sm,
  },
  actionBtnText: { color: COLORS.white, fontSize: FONT_SIZE.md, fontWeight: '700' },
  
  textContainer: { backgroundColor: COLORS.white, padding: SPACING.xl, borderRadius: BORDER_RADIUS.xl, ...SHADOWS.sm },
  extractedText: { fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 22, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  
  summaryContainer: { backgroundColor: COLORS.white, padding: SPACING.xl, borderRadius: BORDER_RADIUS.xl, ...SHADOWS.sm },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  summaryTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text },
  summaryText: { fontSize: FONT_SIZE.md, color: COLORS.text, lineHeight: 24 },
  
  chatArea: { paddingBottom: SPACING.xl },
  qaItem: { marginBottom: SPACING.xl },
  questionBubble: { 
    alignSelf: 'flex-end', backgroundColor: COLORS.primary, padding: SPACING.lg, 
    borderRadius: BORDER_RADIUS.xl, borderBottomRightRadius: 4, maxWidth: '85%', marginBottom: SPACING.sm 
  },
  questionText: { color: COLORS.white, fontSize: FONT_SIZE.md, lineHeight: 22 },
  answerBubble: { 
    alignSelf: 'flex-start', backgroundColor: COLORS.white, padding: SPACING.lg, 
    borderRadius: BORDER_RADIUS.xl, borderBottomLeftRadius: 4, maxWidth: '85%',
    ...SHADOWS.sm, borderWidth: 1, borderColor: COLORS.borderLight
  },
  answerText: { color: COLORS.text, fontSize: FONT_SIZE.md, lineHeight: 22 },
  
  inputContainer: { 
    flexDirection: 'row', alignItems: 'flex-end', padding: SPACING.xl, 
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.borderLight, gap: SPACING.sm
  },
  input: { 
    flex: 1, backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text, minHeight: 48, maxHeight: 120
  },
  sendBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm,
  },
  sendBtnDisabled: { backgroundColor: COLORS.border },
});
