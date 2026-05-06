import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TextInput, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../constants';
import { addressApi } from '../services/api';
import { useColors, useThemeStore } from '../stores/themeStore';
import { loadStateOptions, loadDistrictOptions } from '../utils/addressOptions';

// =============================================================================
// AddressFormPicker — single shared address widget for the platform.
//
// The pattern was already inlined in EditCourtAdminProfileScreen,
// EditOrgProfileScreen, and CourtAdminRegisterScreen with copy-pasted state +
// modal logic. This component is the canonical version — every form that
// collects an address should use it so the user gets the same flow
// everywhere: state → district → pincode → place → free-text address.
//
// Behaviour:
//   1. Tap "State" → modal with searchable list (from /address/states).
//   2. Choose state → district loads from /address/districts/:state.
//   3. Tap "District" → modal with the loaded districts.
//   4. Type a 6-digit pincode and tap "Lookup" → /address/pincode/:code
//      returns post offices; we filter by chosen state+district.
//   5. Single match → auto-set city. Multiple → open a place picker modal.
//   6. Free-text "Address line" for the rest of the address.
//
// All five fields are surfaced via `value` + `onChange({...})` so callers
// own the data — no internal source of truth that can drift from the
// caller's form state.
// =============================================================================

export type AddressValue = {
  state: string;
  district: string;
  pincode: string;
  city: string;
  address: string;
};

export type PostOffice = {
  name: string;
  state?: string;
  district?: string;
  block?: string;
};

type Props = {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  /** Visual hint for required fields. Form-level validation stays with caller. */
  required?: Array<keyof AddressValue>;
  /** Render the address text input as multi-line (default true). */
  multilineAddress?: boolean;
  /** Override labels for niche callers (e.g. "Court address" vs "Address"). */
  labels?: Partial<Record<keyof AddressValue, string>>;
};

const DEFAULT_LABELS: Record<keyof AddressValue, string> = {
  state:    'State',
  district: 'District',
  pincode:  'Pincode',
  city:     'City / Place',
  address:  'Address line',
};

export const AddressFormPicker: React.FC<Props> = ({
  value,
  onChange,
  required = ['state', 'district', 'pincode'],
  multilineAddress = true,
  labels: labelsOverride,
}) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const labels = { ...DEFAULT_LABELS, ...(labelsOverride || {}) };

  // Lookup data
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [locations, setLocations] = useState<PostOffice[]>([]);

  // Loading flags
  const [statesLoading, setStatesLoading] = useState(false);
  const [districtLoading, setDistrictLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  // Modal visibility + search inputs
  const [showStateModal, setShowStateModal] = useState(false);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');

  // Load states on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatesLoading(true);
      const list = await loadStateOptions();
      if (!cancelled) {
        setStates(list);
        setStatesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Reload districts whenever the chosen state changes (e.g. caller resets it).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!value.state) {
        setDistricts([]);
        return;
      }
      setDistrictLoading(true);
      const list = await loadDistrictOptions(value.state);
      if (!cancelled) {
        setDistricts(list);
        setDistrictLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [value.state]);

  const filteredStates = useMemo(() => (
    stateSearch
      ? states.filter((item) => item.toLowerCase().includes(stateSearch.toLowerCase()))
      : states
  ), [states, stateSearch]);

  const filteredDistricts = useMemo(() => (
    districtSearch
      ? districts.filter((item) => item.toLowerCase().includes(districtSearch.toLowerCase()))
      : districts
  ), [districts, districtSearch]);

  const filteredLocations = useMemo(() => (
    locationSearch
      ? locations.filter((item) => item.name.toLowerCase().includes(locationSearch.toLowerCase()))
      : locations
  ), [locations, locationSearch]);

  // Selecting a new state clears every downstream field so the form
  // can't end up with an inconsistent district/pincode/city pair.
  const selectState = (next: string) => {
    onChange({ ...value, state: next, district: '', pincode: '', city: '' });
    setShowStateModal(false);
    setStateSearch('');
    setLocations([]);
  };

  const selectDistrict = (next: string) => {
    onChange({ ...value, district: next, pincode: '', city: '' });
    setShowDistrictModal(false);
    setDistrictSearch('');
    setLocations([]);
  };

  const lookupPincode = async () => {
    const pin = value.pincode.trim();
    if (!/^\d{6}$/.test(pin)) {
      Alert.alert('Invalid pincode', 'Enter a 6-digit pincode.');
      return;
    }
    if (!value.state || !value.district) {
      Alert.alert('Missing selection', 'Pick a state and district before looking up the pincode.');
      return;
    }

    setLocationLoading(true);
    try {
      const { data } = await addressApi.lookupPincode(pin);
      const postOffices = (data?.postOffices || data?.data?.postOffices || []) as PostOffice[];
      const matches = postOffices.filter(
        (item) =>
          item.state?.toLowerCase() === value.state.toLowerCase() &&
          item.district?.toLowerCase() === value.district.toLowerCase(),
      );

      if (!matches.length) {
        setLocations([]);
        Alert.alert(
          'No matches',
          'No locations found for the chosen state, district, and pincode. Double-check the pincode.',
        );
        return;
      }

      setLocations(matches);
      if (matches.length === 1) {
        // Single hit — set it directly, no modal needed.
        onChange({ ...value, city: matches[0].name });
      } else {
        // Multiple hits — let the user pick.
        setShowLocationModal(true);
      }
    } catch {
      setLocations([]);
      Alert.alert('Lookup failed', 'Could not fetch locations for that pincode.');
    } finally {
      setLocationLoading(false);
    }
  };

  const selectLocation = (place: PostOffice) => {
    onChange({ ...value, city: place.name });
    setShowLocationModal(false);
    setLocationSearch('');
  };

  const isReq = (key: keyof AddressValue) => required.includes(key);

  const renderOption = (item: string, onPress: () => void, selected: boolean) => (
    <TouchableOpacity style={[styles.option, selected && styles.optionSelected]} onPress={onPress}>
      <Text style={styles.optionText}>{item}</Text>
      {selected && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
    </TouchableOpacity>
  );

  return (
    <View>
      {/* State picker */}
      <Field label={labels.state} required={isReq('state')} styles={styles}>
        <TouchableOpacity style={styles.selectInput} onPress={() => setShowStateModal(true)}>
          <Text style={[styles.selectText, !value.state && styles.placeholder]}>
            {value.state || 'Select state'}
          </Text>
          {statesLoading ? <ActivityIndicator size="small" color={COLORS.textMuted} /> : <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />}
        </TouchableOpacity>
      </Field>

      {/* District picker */}
      <Field label={labels.district} required={isReq('district')} styles={styles}>
        <TouchableOpacity
          style={[styles.selectInput, !value.state && styles.disabled]}
          onPress={() => value.state && setShowDistrictModal(true)}
          disabled={!value.state}
        >
          <Text style={[styles.selectText, !value.district && styles.placeholder]}>
            {value.district || (value.state ? 'Select district' : 'Pick state first')}
          </Text>
          {districtLoading ? <ActivityIndicator size="small" color={COLORS.textMuted} /> : <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />}
        </TouchableOpacity>
      </Field>

      {/* Pincode + lookup button */}
      <Field label={labels.pincode} required={isReq('pincode')} styles={styles}>
        <View style={styles.pincodeRow}>
          <TextInput
            style={styles.pincodeInput}
            value={value.pincode}
            onChangeText={(t) => onChange({ ...value, pincode: t.replace(/[^\d]/g, '').slice(0, 6) })}
            placeholder="6-digit pincode"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity
            style={[styles.lookupBtn, (!value.state || !value.district || value.pincode.length !== 6 || locationLoading) && styles.disabled]}
            onPress={lookupPincode}
            disabled={!value.state || !value.district || value.pincode.length !== 6 || locationLoading}
          >
            {locationLoading
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={styles.lookupBtnText}>Lookup</Text>}
          </TouchableOpacity>
        </View>
      </Field>

      {/* City / Place — read-only display picked from pincode lookup; tap to re-pick if multiple */}
      {(value.city || locations.length > 0) ? (
        <Field label={labels.city} required={isReq('city')} styles={styles}>
          <TouchableOpacity
            style={[styles.selectInput, locations.length <= 1 && styles.readonly]}
            onPress={() => locations.length > 1 && setShowLocationModal(true)}
            disabled={locations.length <= 1}
          >
            <Text style={[styles.selectText, !value.city && styles.placeholder]}>
              {value.city || 'No place selected'}
            </Text>
            {locations.length > 1 && <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />}
          </TouchableOpacity>
        </Field>
      ) : null}

      {/* Free-text address line */}
      <Field label={labels.address} required={isReq('address')} styles={styles}>
        <TextInput
          style={[styles.textInput, multilineAddress && styles.multilineInput]}
          value={value.address}
          onChangeText={(t) => onChange({ ...value, address: t })}
          placeholder="House / Building, Street, Landmark"
          placeholderTextColor={COLORS.textMuted}
          multiline={multilineAddress}
        />
      </Field>

      {/* Modals */}
      <PickerModal
        visible={showStateModal}
        title={`Select ${labels.state}`}
        search={stateSearch}
        onSearch={setStateSearch}
        items={filteredStates}
        onClose={() => { setShowStateModal(false); setStateSearch(''); }}
        renderItem={(item) => renderOption(item, () => selectState(item), item === value.state)}
        keyExtractor={(item) => item}
        emptyHint={statesLoading ? 'Loading states…' : 'No states match the search.'}
        styles={styles}
        COLORS={COLORS}
      />
      <PickerModal
        visible={showDistrictModal}
        title={`Select ${labels.district}`}
        search={districtSearch}
        onSearch={setDistrictSearch}
        items={filteredDistricts}
        onClose={() => { setShowDistrictModal(false); setDistrictSearch(''); }}
        renderItem={(item) => renderOption(item, () => selectDistrict(item), item === value.district)}
        keyExtractor={(item) => item}
        emptyHint={districtLoading ? 'Loading districts…' : 'No districts match the search.'}
        styles={styles}
        COLORS={COLORS}
      />
      <PickerModal
        visible={showLocationModal}
        title={`Select ${labels.city}`}
        search={locationSearch}
        onSearch={setLocationSearch}
        items={filteredLocations}
        onClose={() => { setShowLocationModal(false); setLocationSearch(''); }}
        renderItem={(item) => renderOption(item.name, () => selectLocation(item), item.name === value.city)}
        keyExtractor={(item) => `${item.name}-${item.block || ''}`}
        emptyHint="No matching place at this pincode."
        styles={styles}
        COLORS={COLORS}
      />
    </View>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

const Field = ({ label, required, children, styles }: any) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>
      {label}{required ? ' *' : ''}
    </Text>
    {children}
  </View>
);

type PickerModalProps<T> = {
  visible: boolean;
  title: string;
  search: string;
  onSearch: (s: string) => void;
  items: T[];
  onClose: () => void;
  renderItem: (item: T) => React.ReactElement;
  keyExtractor: (item: T) => string;
  emptyHint: string;
  styles: any;
  COLORS: any;
};

function PickerModal<T>({ visible, title, search, onSearch, items, onClose, renderItem, keyExtractor, emptyHint, styles, COLORS }: PickerModalProps<T>) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={onSearch}
              placeholder="Search"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
            />
          </View>
          <FlatList
            data={items}
            keyExtractor={keyExtractor}
            renderItem={({ item }) => renderItem(item)}
            ListEmptyComponent={<Text style={styles.modalEmpty}>{emptyHint}</Text>}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ============================================================================
// Styles
// ============================================================================

const getStyles = (C: any) => StyleSheet.create({
  field: { marginBottom: SPACING.md },
  fieldLabel: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: C.textMuted, letterSpacing: 0.3, marginBottom: 6 },

  selectInput: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  selectText: { flex: 1, fontSize: FONT_SIZE.md, color: C.text, marginRight: SPACING.sm },
  placeholder: { color: C.textMuted },
  disabled: { opacity: 0.5 },
  readonly: { opacity: 0.85 },

  pincodeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  pincodeInput: {
    flex: 1, backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: C.text,
  },
  lookupBtn: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: C.primary, borderRadius: BORDER_RADIUS.lg,
    minWidth: 88, alignItems: 'center',
  },
  lookupBtnText: { color: '#FFFFFF', fontSize: FONT_SIZE.sm, fontWeight: '800' },

  textInput: {
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: C.text,
  },
  multilineInput: { minHeight: 70, textAlignVertical: 'top' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: C.white, borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl, maxHeight: '80%', paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: C.text },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginVertical: SPACING.md,
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZE.sm, color: C.text, padding: 0 },

  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  optionSelected: { backgroundColor: C.primaryLight + '12' },
  optionText: { fontSize: FONT_SIZE.md, color: C.text, flex: 1 },

  modalEmpty: { textAlign: 'center', color: C.textMuted, padding: SPACING.xl },
});

export default AddressFormPicker;
