import {
	KnownValue,
	KnownValuesStore,
	IS_A,
	NOTE,
	SIGNED,
	KNOWN_VALUES,
	ID,
} from '../src/index';

describe('KnownValue', () => {
	test('should create a KnownValue with just a value', () => {
		const kv = new KnownValue(42);
		expect(kv.value()).toBe(42);
		expect(kv.assignedName()).toBeUndefined();
		expect(kv.name()).toBe('42');
	});

	test('should create a KnownValue with a value and name', () => {
		const kv = new KnownValue(1, 'isA');
		expect(kv.value()).toBe(1);
		expect(kv.assignedName()).toBe('isA');
		expect(kv.name()).toBe('isA');
	});

	test('should have proper equality based on value only', () => {
		const kv1 = new KnownValue(1, 'isA');
		const kv2 = new KnownValue(1, 'different');
		const kv3 = new KnownValue(2, 'isA');

		expect(kv1.equals(kv2)).toBe(true);
		expect(kv1.equals(kv3)).toBe(false);
	});

	test('should have consistent toString', () => {
		const named = new KnownValue(1, 'isA');
		const unnamed = new KnownValue(42);

		expect(named.toString()).toBe('isA');
		expect(unnamed.toString()).toBe('42');
	});

	test('predefined values should have correct values and names', () => {
		expect(IS_A.value()).toBe(1);
		expect(IS_A.name()).toBe('isA');

		expect(NOTE.value()).toBe(4);
		expect(NOTE.name()).toBe('note');

		expect(SIGNED.value()).toBe(3);
		expect(SIGNED.name()).toBe('signed');

		expect(ID.value()).toBe(2);
		expect(ID.name()).toBe('id');
	});
});

describe('KnownValuesStore', () => {
	test('should create an empty store', () => {
		const store = new KnownValuesStore();
		expect(store.knownValueNamed('isA')).toBeUndefined();
	});

	test('should create a store with initial values', () => {
		const store = new KnownValuesStore([IS_A, NOTE, SIGNED]);

		expect(store.knownValueNamed('isA')).toBe(IS_A);
		expect(store.knownValueNamed('note')).toBe(NOTE);
		expect(store.knownValueNamed('signed')).toBe(SIGNED);
	});

	test('should insert values', () => {
		const store = new KnownValuesStore();
		const custom = new KnownValue(100, 'custom');

		store.insert(custom);
		expect(store.knownValueNamed('custom')).toBe(custom);
	});

	test('should get assigned names', () => {
		const store = new KnownValuesStore([IS_A, NOTE]);

		expect(store.assignedName(IS_A)).toBe('isA');
		expect(store.assignedName(NOTE)).toBe('note');
		expect(store.assignedName(new KnownValue(999))).toBeUndefined();
	});

	test('should get names with fallback to value', () => {
		const store = new KnownValuesStore([IS_A, NOTE]);

		expect(store.name(IS_A)).toBe('isA');
		expect(store.name(new KnownValue(999))).toBe('999');
	});

	test('should look up by raw value', () => {
		const store = new KnownValuesStore([IS_A, NOTE]);

		const isA = KnownValuesStore.knownValueForRawValue(1, store);
		expect(isA.equals(IS_A)).toBe(true);

		const unknown = KnownValuesStore.knownValueForRawValue(999, store);
		expect(unknown.value()).toBe(999);
		expect(unknown.assignedName()).toBeUndefined();
	});

	test('should look up by name', () => {
		const store = new KnownValuesStore([IS_A, NOTE]);

		const isA = KnownValuesStore.knownValueForName('isA', store);
		expect(isA?.value()).toBe(1);

		const unknown = KnownValuesStore.knownValueForName('unknown', store);
		expect(unknown).toBeUndefined();
	});

	test('should get name for a known value', () => {
		const store = new KnownValuesStore([IS_A, NOTE]);

		expect(KnownValuesStore.nameForKnownValue(IS_A, store)).toBe('isA');
		expect(KnownValuesStore.nameForKnownValue(new KnownValue(999), store)).toBe('999');
		expect(KnownValuesStore.nameForKnownValue(IS_A, undefined)).toBe('isA');
	});

	test('should clone the store', () => {
		const store1 = new KnownValuesStore([IS_A, NOTE]);
		const store2 = store1.clone();

		const custom = new KnownValue(100, 'custom');
		store2.insert(custom);

		expect(store1.knownValueNamed('custom')).toBeUndefined();
		expect(store2.knownValueNamed('custom')).toBe(custom);
	});
});

describe('Global KNOWN_VALUES Registry', () => {
	test('should provide access to the global store', () => {
		const store = KNOWN_VALUES.get();

		expect(store.knownValueNamed('isA')?.value()).toBe(1);
		expect(store.knownValueNamed('note')?.value()).toBe(4);
		expect(store.knownValueNamed('signed')?.value()).toBe(3);
	});

	test('should cache the store', () => {
		const store1 = KNOWN_VALUES.get();
		const store2 = KNOWN_VALUES.get();

		expect(store1).toBe(store2);
	});

	test('should contain all predefined values', () => {
		const store = KNOWN_VALUES.get();

		expect(store.knownValueNamed('id')?.value()).toBe(2);
		expect(store.knownValueNamed('entity')?.value()).toBe(10);
		expect(store.knownValueNamed('name')?.value()).toBe(11);
		expect(store.knownValueNamed('isA')?.value()).toBe(1);
	});
});
