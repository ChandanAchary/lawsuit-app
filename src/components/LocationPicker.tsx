import {  useThemeStore , useColors } from '../stores/themeStore';
import React, { useState, useEffect, useRef } from 'react';

// Module-level cache so results persist across component mounts
const pincodeResultsCache = new Map<string, any[]>();
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TextInput,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../constants';
import { addressApi } from '../services/api';
import { loadDistrictOptions, loadStateOptions } from '../utils/addressOptions';
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
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [states, setStates] = useState<string[]>([]);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [districts, setDistricts] = useState<string[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [postOffices, setPostOffices] = useState<any[]>([]);
  const [showPlacePicker, setShowPlacePicker] = useState(false);
  const [loadingPincode, setLoadingPincode] = useState(false);
  const [pincodeError, setPincodeError] = useState('');
  const [pincodeHint, setPincodeHint] = useState('');
  const isFetchingRef = useRef(false);
  // Area/City search state
  const [areaSearch, setAreaSearch] = useState('');
  const filteredPostOffices = areaSearch
    ? postOffices.filter((po: any) => (po.name || po.postOfficeName || '').toLowerCase().includes(areaSearch.toLowerCase()))
    : postOffices;
  const filteredDistricts = districtSearch
    ? districts.filter((d) => d.toLowerCase().includes(districtSearch.toLowerCase()))
    : districts;

  useEffect(() => {
    void loadStateOptions().then((resolved) => setStates(resolved));
  }, []);

  useEffect(() => {
    const currentState = value.state?.trim();
    if (!currentState) {
      setDistricts([]);
      return;
    }

    setLoadingDistricts(true);
    void loadDistrictOptions(currentState)
      .then((list) => setDistricts(list))
      .finally(() => setLoadingDistricts(false));
  }, [value.state]);

  const handlePincodeLookup = async (pincode: string, silent = false) => {
    if (!silent) onChange({ pincode });
    if (pincode.length !== 6) {
      if (!silent) {
        setPostOffices([]);
        setPincodeError('');
        setPincodeHint(pincode.length > 0 ? 'Enter all 6 digits then tap search' : '');
      }
      return;
    }
    setPincodeHint('');
    // Serve from cache — avoids re-fetch for same pincode
    if (pincodeResultsCache.has(pincode)) {
      const cached = pincodeResultsCache.get(pincode)!;
      setPostOffices(cached);
      setPincodeError('');
      const filtered = cached.filter((po: any) => {
        const stateOk = !value.state || po.state?.toLowerCase() === value.state.toLowerCase();
        const districtOk = !value.district || po.district?.toLowerCase() === value.district.toLowerCase();
        return stateOk && districtOk;
      });
      setPostOffices(filtered);
      if (!silent && filtered.length > 0) {
        const first = filtered[0];
        onChange({ pincode, state: first.state || value.state, district: first.district || value.district });
      }
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!silent) setLoadingPincode(true);
    setPincodeError('');
    try {
      const { data } = await addressApi.lookupPincode(pincode);
      const offices = data?.postOffices || data?.data?.postOffices || [];
      const filtered = (offices as any[]).filter((po: any) => {
        const stateOk = !value.state || po.state?.toLowerCase() === value.state.toLowerCase();
        const districtOk = !value.district || po.district?.toLowerCase() === value.district.toLowerCase();
        return stateOk && districtOk;
      });
      const success = data?.success !== false && offices.length > 0;
      if (success) {
        pincodeResultsCache.set(pincode, offices);
        setPostOffices(filtered);
        const first = filtered[0];
        if (!first) {
          if (!silent) setPincodeError('No records found for selected state/district and pincode');
          return;
        }
        onChange({ pincode, state: first.state || value.state, district: first.district || value.district });
        if (filtered.length === 1) {
          onChange({
            pincode,
            state: first.state,
            district: first.district,
            city: first.name,
            postOfficeName: first.name,
          });
        }
      } else {
        if (!silent) setPincodeError('No records found for this pincode');
        setPostOffices([]);
      }
    } catch {
      if (!silent) setPincodeError('Failed to lookup pincode');
    } finally {
      isFetchingRef.current = false;
      if (!silent) setLoadingPincode(false);
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

      {/* District Picker */}
      <Text style={styles.fieldLabel}>District</Text>
      <TouchableOpacity
        style={[styles.dropdown, !value.state && styles.dropdownDisabled]}
        disabled={!value.state}
        onPress={() => setShowDistrictPicker(true)}
      >
        <Text style={value.district ? styles.dropdownText : styles.dropdownPlaceholder}>
          {value.district || (value.state ? 'Select district' : 'Select state first')}
        </Text>
        {loadingDistricts ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
        )}
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
          style={[styles.pincodeBtn, value.pincode?.length === 6 ? styles.pincodeBtnActive : null]}
          onPress={() => {
            // Clear cache for this pincode so user can force a refresh
            if (value.pincode?.length === 6) {
              pincodeResultsCache.delete(value.pincode);
              void handlePincodeLookup(value.pincode);
            }
          }}
        >
          {loadingPincode ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="search" size={18} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>
      {pincodeError ? <Text style={styles.errorText}>{pincodeError}</Text> : null}
      {!pincodeError && pincodeHint ? <Text style={styles.hintText}>{pincodeHint}</Text> : null}

      {/* Area/City Dropdown after pincode lookup or when city already selected */}
      {(postOffices.length > 0 || value.city) && (
        <>
          <Text style={styles.fieldLabel}>Area / City</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => {
              // Restore from cache silently — never triggers the search button spinner
              if (postOffices.length === 0 && value.pincode?.length === 6) {
                const cached = pincodeResultsCache.get(value.pincode);
                if (cached) {
                  setPostOffices(cached);
                } else {
                  void handlePincodeLookup(value.pincode, true);
                }
              }
              setShowPlacePicker(true);
            }}
          >
            <Text style={value.city || value.postOfficeName ? styles.dropdownText : styles.dropdownPlaceholder}>
              {value.city || value.postOfficeName || 'Select area / city'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </>
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
                  onPress={() => {
                    onChange({
                      state: item,
                      district: '',
                      pincode: '',
                      city: '',
                      postOfficeName: '',
                    });
                    setPostOffices([]);
                    setShowStatePicker(false);
                    setStateSearch('');
                  }}
                >
                  <Text style={[styles.listItemText, item === value.state && styles.listItemTextActive]}>{item}</Text>
                  {item === value.state && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* District Picker Modal */}
      <Modal visible={showDistrictPicker} transparent animationType="slide" onRequestClose={() => setShowDistrictPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select District</Text>
              <TouchableOpacity onPress={() => setShowDistrictPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search district..."
                placeholderTextColor={COLORS.textMuted}
                value={districtSearch}
                onChangeText={setDistrictSearch}
              />
            </View>
            <FlatList
              data={filteredDistricts}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.listItem, item === value.district && styles.listItemActive]}
                  onPress={() => {
                    onChange({ district: item, pincode: '', city: '', postOfficeName: '' });
                    setPostOffices([]);
                    setShowDistrictPicker(false);
                    setDistrictSearch('');
                  }}
                >
                  <Text style={[styles.listItemText, item === value.district && styles.listItemTextActive]}>{item}</Text>
                  {item === value.district && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: SPACING.xl }}>
                  <Text style={styles.listItemSub}>No districts found.</Text>
                </View>
              }
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
            {/* Area/City Search */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search area/city..."
                placeholderTextColor={COLORS.textMuted}
                value={areaSearch}
                onChangeText={setAreaSearch}
              />
            </View>
            {filteredPostOffices.length > 0 ? (
              <ScrollView
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ paddingBottom: SPACING.xl }}
              >
                {filteredPostOffices.map((item: any, i: number) => (
                  <TouchableOpacity
                    key={`${item.name || item.postOfficeName || i}-${i}`}
                    style={styles.listItem}
                    onPress={() => selectPlace(item)}
                  >
                    <View>
                      <Text style={styles.listItemText}>{item.name || item.postOfficeName || item.post_office_name}</Text>
                      {(item.district || item.state) ? (
                        <Text style={styles.listItemSub}>{item.district || item.taluk || ''}{item.district ? ', ' : ''}{item.state || ''}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : value.city ? (
              <TouchableOpacity style={[styles.placeOption, styles.placeOptionActive]} onPress={() => selectPlace({ name: value.city, district: value.district, state: value.state })}>
                <View>
                  <Text style={styles.placeOptionText}>{value.city}</Text>
                  <Text style={styles.placeOptionSub}>{value.district}, {value.state}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={{ padding: SPACING.xl }}>
                <Text style={styles.listItemSub}>No areas found for this PIN code.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const InfoRow = ({ icon, label, value, COLORS, styles }: any) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon as any} size={18} color={COLORS.textMuted} />
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const getStyles = (COLORS: any) => StyleSheet.create({
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
  dropdownDisabled: { opacity: 0.6 },
  pincodeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  pincodeInput: {
    flex: 1, backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: SPACING.md + 2, paddingHorizontal: SPACING.lg,
    fontSize: FONT_SIZE.md, color: COLORS.text,
  },
  pincodeBtn: {
    width: 48, height: 48, borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  pincodeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  errorText: { fontSize: FONT_SIZE.xs, color: COLORS.error, marginTop: -SPACING.sm, marginBottom: SPACING.sm },
  hintText: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: -SPACING.sm, marginBottom: SPACING.sm },
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
