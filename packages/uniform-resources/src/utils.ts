import { InvalidTypeError } from './error';

/**
 * Checks if a character is a valid UR type character.
 * Valid characters are lowercase letters, digits, and hyphens.
 */
export function isURTypeChar(char: string): boolean {
	const code = char.charCodeAt(0);
	// Check for lowercase letters (a-z)
	if (code >= 97 && code <= 122) return true;
	// Check for digits (0-9)
	if (code >= 48 && code <= 57) return true;
	// Check for hyphen (-)
	if (code === 45) return true;
	return false;
}

/**
 * Checks if a string is a valid UR type.
 * Valid UR types contain only lowercase letters, digits, and hyphens.
 */
export function isValidURType(urType: string): boolean {
	if (urType.length === 0) return false;
	return Array.from(urType).every((char) => isURTypeChar(char));
}

/**
 * Validates and returns a UR type, or throws an error if invalid.
 */
export function validateURType(urType: string): string {
	if (!isValidURType(urType)) {
		throw new InvalidTypeError();
	}
	return urType;
}

/**
 * Bytewords for encoding/decoding bytes as words.
 * See: https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-004-bytewords.md
 */
export const BYTEWORDS: string[] = [
	'able', 'acid', 'also', 'apex', 'aqua', 'arch', 'atom', 'aunt', 'away',
	'axis', 'back', 'bald', 'barn', 'belt', 'beta', 'bias', 'blue', 'body',
	'brag', 'brew', 'bulb', 'buzz', 'calm', 'cash', 'cats', 'chef', 'city',
	'claw', 'code', 'cola', 'cook', 'cost', 'crux', 'curl', 'cusp', 'cyan',
	'dark', 'data', 'days', 'deli', 'dice', 'diet', 'door', 'down', 'draw',
	'drop', 'drum', 'dull', 'duty', 'each', 'easy', 'echo', 'edge', 'epic',
	'even', 'exam', 'exit', 'eyes', 'fact', 'fair', 'fern', 'figs', 'film',
	'fish', 'fizz', 'flap', 'flew', 'flux', 'foxy', 'free', 'frog', 'fuel',
	'fund', 'gala', 'game', 'gear', 'gems', 'gift', 'girl', 'glow', 'good',
	'gray', 'grim', 'guru', 'gush', 'gyro', 'half', 'hang', 'hard', 'hawk',
	'heat', 'help', 'high', 'hill', 'holy', 'hope', 'horn', 'huts', 'iced',
	'idea', 'idle', 'inch', 'inky', 'into', 'iris', 'iron', 'item', 'jade',
	'jazz', 'join', 'jolt', 'jowl', 'judo', 'jugs', 'jump', 'junk', 'jury',
	'keep', 'keno', 'kept', 'keys', 'kick', 'kiln', 'king', 'kite', 'kiwi',
	'knob', 'lamb', 'lava', 'lazy', 'leaf', 'legs', 'liar', 'limp', 'lion',
	'list', 'logo', 'loud', 'love', 'luau', 'luck', 'lung', 'main', 'many',
	'math', 'maze', 'memo', 'menu', 'meow', 'mild', 'mint', 'miss', 'monk',
	'nail', 'navy', 'need', 'news', 'next', 'noon', 'note', 'numb', 'obey',
	'oboe', 'omit', 'onyx', 'open', 'oval', 'owls', 'paid', 'part', 'peck',
	'play', 'plus', 'poem', 'pool', 'pose', 'puff', 'puma', 'purr', 'quad',
	'quiz', 'race', 'ramp', 'real', 'redo', 'rich', 'road', 'rock', 'roof',
	'ruby', 'ruin', 'runs', 'rust', 'safe', 'saga', 'scar', 'sets', 'silk',
	'skew', 'slot', 'soap', 'solo', 'song', 'stub', 'surf', 'swan', 'taco',
	'task', 'taxi', 'tent', 'tied', 'time', 'tiny', 'toil', 'tomb', 'toys',
	'trip', 'tuna', 'twin', 'ugly', 'undo', 'unit', 'urge', 'user', 'vast',
	'very', 'veto', 'vial', 'vibe', 'view', 'visa', 'void', 'vows', 'wall',
	'wand', 'warm', 'wasp', 'wave', 'waxy', 'webs', 'what', 'when', 'whiz',
	'wolf', 'work', 'yank', 'yawn', 'yell', 'yoga', 'yurt', 'zaps', 'zero',
	'zest', 'zinc', 'zone', 'zoom',
];

/**
 * Create a reverse mapping for fast byteword lookup.
 */
function createBytewordsMap(): Map<string, number> {
	const map = new Map<string, number>();
	BYTEWORDS.forEach((word, index) => {
		map.set(word, index);
	});
	return map;
}

export const BYTEWORDS_MAP = createBytewordsMap();

/**
 * Bytemojis for encoding/decoding bytes as emojis.
 * See: https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2024-008-bytemoji.md
 */
export const BYTEMOJIS: string[] = [
	'😀', '😂', '😆', '😉', '🙄', '😋', '😎', '😍', '😘', '😭', '🫠', '🥱',
	'🤩', '😶', '🤨', '🫥', '🥵', '🥶', '😳', '🤪', '😵', '😡', '🤢', '😇',
	'🤠', '🤡', '🥳', '🥺', '😬', '🤑', '🙃', '🤯', '😈', '👹', '👺', '💀',
	'👻', '👽', '😺', '😹', '😻', '😽', '🙀', '😿', '🫶', '🤲', '🙌', '🤝',
	'👍', '👎', '👈', '👆', '💪', '👄', '🦷', '👂', '👃', '🧠', '👀', '🤚',
	'🦶', '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🍍',
	'🥝', '🍆', '🥑', '🥦', '🍅', '🌽', '🥕', '🫒', '🧄', '🥐', '🥯', '🍞',
	'🧀', '🥚', '🍗', '🌭', '🍔', '🍟', '🍕', '🌮', '🥙', '🍱', '🍜', '🍤',
	'🍚', '🥠', '🍨', '🍦', '🎂', '🪴', '🌵', '🌱', '💐', '🍁', '🍄', '🌹',
	'🌺', '🌼', '🌻', '🌸', '💨', '🌊', '💧', '💦', '🌀', '🌈', '🌞', '🌝',
	'🌛', '🌜', '🌙', '🌎', '💫', '⭐', '🪐', '🌐', '💛', '💔', '💘', '💖',
	'💕', '🏁', '🚩', '💬', '💯', '🚫', '🔴', '🔷', '🟩', '🛑', '🔺', '🚗',
	'🚑', '🚒', '🚜', '🛵', '🚨', '🚀', '🚁', '🛟', '🚦', '🏰', '🎡', '🎢',
	'🎠', '🏠', '🔔', '🔑', '🚪', '🪑', '🎈', '💌', '📦', '📫', '📖', '📚',
	'📌', '🧮', '🔒', '💎', '📷', '⏰', '⏳', '📡', '💡', '💰', '🧲', '🧸',
	'🎁', '🎀', '🎉', '🪭', '👑', '🫖', '🔭', '🛁', '🏆', '🥁', '🎷', '🎺',
	'🏀', '🏈', '🎾', '🏓', '✨', '🔥', '💥', '👕', '👚', '👖', '🩳', '👗',
	'👔', '🧢', '👓', '🧶', '🧵', '💍', '👠', '👟', '🧦', '🧤', '👒', '👜',
	'🐱', '🐶', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮',
	'🐷', '🐸', '🐵', '🐔', '🐥', '🦆', '🦉', '🐴', '🦄', '🐝', '🐛', '🦋',
	'🐌', '🐞', '🐢', '🐺', '🐍', '🪽', '🐙', '🦑', '🪼', '🦞', '🦀', '🐚',
	'🦭', '🐟', '🐬', '🐳',
];

/**
 * Encodes a 4-byte slice as a string of bytewords for identification.
 */
export function encodeBytewordsIdentifier(data: Uint8Array): string {
	if (data.length !== 4) {
		throw new Error('Identifier data must be exactly 4 bytes');
	}
	const words: string[] = [];
	for (let i = 0; i < 4; i++) {
		const byte = data[i];
		if (byte === undefined) throw new Error('Invalid byte');
		const word = BYTEWORDS[byte];
		if (!word) throw new Error('Invalid byteword mapping');
		words.push(word);
	}
	return words.join(' ');
}

/**
 * Encodes a 4-byte slice as a string of bytemojis for identification.
 */
export function encodeBytemojisIdentifier(data: Uint8Array): string {
	if (data.length !== 4) {
		throw new Error('Identifier data must be exactly 4 bytes');
	}
	const emojis: string[] = [];
	for (let i = 0; i < 4; i++) {
		const byte = data[i];
		if (byte === undefined) throw new Error('Invalid byte');
		const emoji = BYTEMOJIS[byte];
		if (!emoji) throw new Error('Invalid bytemoji mapping');
		emojis.push(emoji);
	}
	return emojis.join(' ');
}
