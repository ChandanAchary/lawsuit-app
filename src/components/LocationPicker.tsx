import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TextInput,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../constants';
import { addressApi } from '../services/api';
import { Input } from './Input';

interface LocationData {
  country: string;
  state: string;
  pincode: string;
  district: string;
  city: string;
  postOfficeName: string;
  houseNameOrNumber: string;
  streetName: string;
}

interface LocationPickerProps {
  value: LocationData;
  onChange: (data: Partial<LocationData>) => void;
  editable?: boolean;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange, editable = true }) => {
  const [states, setStates] = useState<string[]>([]);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [postOffices, setPostOffices] = useState<any[]>([]);
  const [showPlacePicker, setShowPlacePicker] = useState(false);
  const [loadingPincode, setLoadingPincode] = useState(false);
  const [pincodeError, setPincodeError] = useState('');

  useEffect(() => {
    addressApi.getStates().then(({ data }) => {
      const list = data?.data?.states || data?.states || [];
      setStates(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  const handlePincodeLookup = async (pincode: string) => {
    onChange({ pincode });
    if (pincode.length !== 6) {
      setPostOffices([]);
      setPincodeError('');
      return;
    }
    setLoadingPincode(true);
    setPincodeError('');
    try {
      const { data } = await addressApi.lookupPincode(pincode);
      const offices = data?.postOffices || data?.data?.postOffices || [];
      const success = data?.success !== false && offices.length > 0;
      if (success) {
        setPostOffices(offices);
        // Auto-set state & district from first result
        const first = offices[0];
        onChange({
          pincode,
          state: first.state || value.state,
          district: first.district || value.district,
        });
        if (offices.length === 1) {
          onChange({
            pincode,
            state: first.state,
            district: first.district,
            city: first.name,
            postOfficeName: first.name,
          });
        }
      } else {
        setPincodeError('No records found for this pincode');
        setPostOffices([]);
      }
    } catch {
      setPincodeError('Failed to lookup pincode');
    } finally {
      setLoadingPincode(false);
    }
  };

  const selectPlace = (po: any) => {
    onChange({
      city: po.name,
      postOfficeName: po.name,
      district: po.district,
      state: po.state,
    });
    setShowPlacePicker(false);
  };

  const filteredStates = stateSearch
    ? states.filter((s) => s.toLowerCase().includes(stateSearch.toLowerCase()))
    : states;

  if (!editable) {
    return (
      <View>
        <InfoRow icon="flag-outline" label="Country" value={value.country || 'India'} />
        <InfoRow icon="map-outline" label="State" value={value.state || '—'} />
        <InfoRow icon="pin-outline" label="Pincode" value={value.pincode || '—'} />
        <InfoRow icon="location-outline" label="Area / City" value={value.city || value.postOfficeName || '—'} />
        <InfoRow icon="business-outline" label="District" value={value.district || '—'} />
        <InfoRow icon="home-outline" label="House / Flat No." value={value.houseNameOrNumber || '—'} />
        <InfoRow icon="navigate-outline" label="Street / Locality" value={value.streetName || '—'} />
      </View>
    );
  }

  return (
    <View>
      {/* Country — locked to India */}
      <View style={styles.lockedField}>
        <Text style={styles.flagIcon}>🇮🇳</Text>
        <Text style={styles.lockedText}>India</Text>
        <Ionicons name="lock-closed-outline" size={16} color={COLORS.textMuted} />
      </View>

      {/* State Picker */}
      <Text style={styles.fieldLabel}>State / Union Territory</Text>
      <TouchableOpacity style={styles.dropdown} onPress={() => setShowStatePicker(true)}>
        <Text style={value.state ? styles.dropdownText : styles.dropdownPlaceholder}>
          {value.state || 'Select your state'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>

      {/* Pincode */}
      <Text style={styles.fieldLabel}>Pincode</Text>
      <View style={styles.pincodeRow}>
        <TextInput
          style={styles.pincodeInput}
          placeholder="6-digit PIN code"
          placeholderTextColor={COLORS.textMuted}
          value={value.pincode}
          onChangeText={handlePincodeLookup}
          keyboardType="number-pad"
          maxLength={6}
        />
        <TouchableOpacity
          style={styles.pincodeBtn}
          onPress={() => value.pincode?.length === 6 && handlePincodeLookup(value.pincode)}
        >
          {loadingPincode ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="search" size={18} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>
      {pincodeError ? <Text style={styles.errorText}>{pincodeError}</Text> : null}

      {/* Inline place picker when post offices available */}
      {postOffices.length > 0 && (
        <View style={styles.placePickerBox}>
          <Text style={styles.fieldLabel}>Select Area / Post Office</Text>
          {postOffices.map((po, i) => (
            <TouchableOpacity
              key={`${po.name}-${i}`}
              style={[
                styles.placeOption,
                (value.city === po.name || value.postOfficeName === po.name) && styles.placeOptionActive,
              ]}
              onPress={() => selectPlace(po)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[
                  styles.placeOptionText,
                  (value.city === po.name || value.postOfficeName === po.name) && styles.placeOptionTextActive,
                ]}>{po.name}</Text>
                <Text style={styles.placeOptionSub}>{po.district}, {po.state}</Text>
              </View>
              {(value.city === po.name || value.postOfficeName === po.name) && (
                <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* House / Flat */}
      <Input
        label="House / Flat No."
        value={value.houseNameOrNumber}
        onChangeText={(v) => onChange({ houseNameOrNumber: v })}
        placeholder="e.g. 12B, 3rd Floor"
        icon={<Ionicons name="home-outline" size={20} color={COLORS.textMuted} />}
      />

      {/* Street */}
      <Input
        label="Street / Locality"
        value={value.streetName}
        onChangeText={(v) => onChange({ streetName: v })}
        placeholder="e.g. MG Road, Sector 5"
        icon={<Ionicons name="navigate-outline" size={20} color={COLORS.textMuted} />}
      />

      {/* State Picker Modal */}
      <Modal visible={showStatePicker} transparent animationType="slide" onRequestClose={() => setShowStatePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setShowStatePicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search state..."
                placeholderTextColor={COLORS.textMuted}
                value={stateSearch}
                onChangeText={setStateSearch}
              />
            </View>
            <FlatList
              data={filteredStates}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.listItem, item === value.state && styles.listItemActive]}
                  onPress={() => { onChange({ state: item }); setShowStatePicker(false); setStateSearch(''); }}
                >
                  <Text style={[styles.listItemText, item === value.state && styles.listItemTextActive]}>{item}</Text>
                  {item === value.state && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Place Picker Modal */}
      <Modal visible={showPlacePicker} transparent animationType="slide" onRequestClose={() => setShowPlacePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Area / City</Text>
              <TouchableOpacity onPress={() => setShowPlacePicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={postOffices}
              keyExtractor={(item, i) => `${item.name}-${i}`}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.listItem} onPress={() => selectPlace(item)}>
                  <View>
                    <Text style={styles.listItemText}>{item.name}</Text>
                    <Text style={styles.listItemSub}>{item.district}, {item.state}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon as any} size={18} color={COLORS.textMuted} />
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  lockedField: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: SPACING.md + 2, paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  flagIcon: { fontSize: 20 },
  lockedText: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  fieldLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm },
  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: SPACING.md + 2, paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  dropdownText: { fontSize: FONT_SIZE.md, color: COLORS.text },
  dropdownPlaceholder: { fontSize: FONT_SIZE.md, color: COLORS.textMuted },
  pincodeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  pincodeInput: {
    flex: 1, backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: SPACING.md + 2, paddingHorizontal: SPACING.lg,
    fontSize: FONT_SIZE.md, color: COLORS.text,
  },
  pincodeBtn: {
    width: 48, height: 48, borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.textMuted, alignItems: 'center', justifyContent: 'center',
  },
  errorText: { fontSize: FONT_SIZE.xs, color: COLORS.error, marginTop: -SPACING.sm, marginBottom: SPACING.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl, maxHeight: '70%',
    paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.xl, marginVertical: SPACING.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.text, paddingVertical: SPACING.xs },
  listItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  listItemActive: { backgroundColor: COLORS.primaryLight + '10' },
  listItemText: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text },
  listItemTextActive: { fontWeight: '700', color: COLORS.primary },
  listItemSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  placePickerBox: { marginBottom: SPACING.lg },
  placeOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm, backgroundColor: COLORS.surfaceAlt,
  },
  placeOptionActive: {
    borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight + '10',
  },
  placeOptionText: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text },
  placeOptionTextActive: { fontWeight: '700', color: COLORS.primary },
  placeOptionSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
  infoLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  infoValue: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginTop: 2 },
});
