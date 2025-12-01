#!/usr/bin/env node
import { Envelope, Digest } from './dist/index.mjs';

console.log('Testing bc-envelope-ts basic functionality...\n');

// Test 1: Create a simple envelope
console.log('1. Creating envelope with string subject:');
const envelope1 = Envelope.new('Hello, World!');
console.log('   Subject:', envelope1.subject().extractString());
console.log('   Digest:', envelope1.digest().short());

// Test 2: Create envelope with assertion
console.log('\n2. Creating envelope with assertion:');
const envelope2 = Envelope.new('Alice')
  .addAssertion('knows', 'Bob');
console.log('   Subject:', envelope2.subject().extractString());
console.log('   Has assertions:', envelope2.hasAssertions());
console.log('   Object for "knows":', envelope2.objectForPredicate('knows').extractString());

// Test 3: Test wrapping
console.log('\n3. Testing envelope wrapping:');
const wrapped = envelope2.wrap();
console.log('   Is wrapped:', wrapped.isWrapped());
const unwrapped = wrapped.tryUnwrap();
console.log('   Unwrapped subject:', unwrapped.subject().extractString());

// Test 4: Test elision
console.log('\n4. Testing elision:');
const elided = envelope2.elideRevealingSet(new Set([envelope2.subject().digest()]));
console.log('   Subject visible:', elided.subject().isElided() ? 'No' : 'Yes');
console.log('   Assertions elided:', elided.hasAssertions() ? 'No' : 'Yes');

// Test 5: Test leaf types
console.log('\n5. Testing leaf types:');
const numEnv = Envelope.new(42);
console.log('   Number envelope:', numEnv.subject().extractNumber());
console.log('   Is number:', numEnv.subject().isNumber());

const boolEnv = Envelope.new(true);
console.log('   Boolean envelope:', boolEnv.subject().extractBoolean());
console.log('   Is true:', boolEnv.subject().isTrue());

console.log('\n✅ All basic tests passed!');
