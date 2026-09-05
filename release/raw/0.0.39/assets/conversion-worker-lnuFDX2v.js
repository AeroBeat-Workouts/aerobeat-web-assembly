(function() {
	//#region ../aerobeat-web-hash/src/index.js
	/** @typedef {string | ArrayBuffer | ArrayBufferView} HashInput */
	/** @typedef {{ backend?: "auto" | "native" | "fallback" }} HashOptions */
	const BLOCK_BYTES = 64;
	const HEX = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, "0"));
	const UTF8 = new TextEncoder();
	const BACKENDS = /* @__PURE__ */ new Set([
		"auto",
		"native",
		"fallback"
	]);
	const ARRAY_BUFFER_LENGTH = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get;
	const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
	const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer").get;
	const TYPED_ARRAY_OFFSET = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteOffset").get;
	const TYPED_ARRAY_LENGTH = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteLength").get;
	const DATA_VIEW_BUFFER = Object.getOwnPropertyDescriptor(DataView.prototype, "buffer").get;
	const DATA_VIEW_OFFSET = Object.getOwnPropertyDescriptor(DataView.prototype, "byteOffset").get;
	const DATA_VIEW_LENGTH = Object.getOwnPropertyDescriptor(DataView.prototype, "byteLength").get;
	function bytesOf(input) {
		if (typeof input === "string") return UTF8.encode(input);
		try {
			ARRAY_BUFFER_LENGTH.call(input);
			return new Uint8Array(input);
		} catch {}
		if (ArrayBuffer.isView(input)) try {
			let buffer;
			let offset;
			let length;
			try {
				buffer = TYPED_ARRAY_BUFFER.call(input);
				offset = TYPED_ARRAY_OFFSET.call(input);
				length = TYPED_ARRAY_LENGTH.call(input);
			} catch {
				buffer = DATA_VIEW_BUFFER.call(input);
				offset = DATA_VIEW_OFFSET.call(input);
				length = DATA_VIEW_LENGTH.call(input);
			}
			ARRAY_BUFFER_LENGTH.call(buffer);
			return new Uint8Array(buffer, offset, length);
		} catch {}
		throw new TypeError("Hash input must be a string, ArrayBuffer, or ArrayBuffer view");
	}
	function lowerHex(bytes) {
		let result = "";
		for (let index = 0; index < bytes.length; index += 1) result += HEX[bytes[index]];
		return result;
	}
	function rotl(value, shift) {
		return (value << shift | value >>> 32 - shift) >>> 0;
	}
	function rotr(value, shift) {
		return (value >>> shift | value << 32 - shift) >>> 0;
	}
	var IncrementalHash = class {
		constructor() {
			this._block = new Uint8Array(BLOCK_BYTES);
			this._peakBufferedBytes = 0;
			this.reset();
		}
		/**
		* Reset this instance to its algorithm's initial state.
		* @returns {this}
		*/
		reset() {
			this._block.fill(0);
			this._blockLength = 0;
			this._bytesLow = 0;
			this._bytesHigh = 0;
			this._blocksProcessed = 0;
			this._peakBufferedBytes = 0;
			this._finalized = false;
			this._digest = null;
			this._initialize();
			return this;
		}
		/**
		* Add bytes synchronously. Input views honor their exact byte offset and length.
		* @param {HashInput} input
		* @returns {this}
		*/
		update(input) {
			if (this._finalized) throw new Error("Hash instance is finalized; call reset() before update()");
			const bytes = bytesOf(input);
			this._addLength(bytes.byteLength);
			let offset = 0;
			if (this._blockLength > 0) {
				const take = Math.min(BLOCK_BYTES - this._blockLength, bytes.byteLength);
				this._block.set(bytes.subarray(0, take), this._blockLength);
				this._blockLength += take;
				offset += take;
				this._peakBufferedBytes = Math.max(this._peakBufferedBytes, this._blockLength);
				if (this._blockLength === BLOCK_BYTES) {
					this._compress(this._block, 0);
					this._blocksProcessed += 1;
					this._blockLength = 0;
				}
			}
			while (offset + BLOCK_BYTES <= bytes.byteLength) {
				this._compress(bytes, offset);
				this._blocksProcessed += 1;
				offset += BLOCK_BYTES;
			}
			if (offset < bytes.byteLength) {
				this._block.set(bytes.subarray(offset), 0);
				this._blockLength = bytes.byteLength - offset;
				this._peakBufferedBytes = Math.max(this._peakBufferedBytes, this._blockLength);
			}
			return this;
		}
		/**
		* Finalize and return a fresh digest copy. Repeated calls are deterministic.
		* @returns {Uint8Array}
		*/
		digest() {
			if (!this._finalized) {
				const highBits = (this._bytesHigh << 3 | this._bytesLow >>> 29) >>> 0;
				const lowBits = this._bytesLow << 3 >>> 0;
				this._block[this._blockLength] = 128;
				this._blockLength += 1;
				if (this._blockLength > 56) {
					this._block.fill(0, this._blockLength);
					this._compress(this._block, 0);
					this._blocksProcessed += 1;
					this._blockLength = 0;
				}
				this._block.fill(0, this._blockLength, 56);
				const view = new DataView(this._block.buffer);
				view.setUint32(56, highBits, false);
				view.setUint32(60, lowBits, false);
				this._compress(this._block, 0);
				this._blocksProcessed += 1;
				this._digest = this._serialize();
				this._finalized = true;
				this._block.fill(0);
				this._blockLength = 0;
			}
			return this._digest.slice();
		}
		/**
		* Finalize and return canonical lowercase hexadecimal text.
		* @returns {string}
		*/
		digestHex() {
			return lowerHex(this.digest());
		}
		/**
		* Return bounded, input-free operational diagnostics.
		* @returns {Readonly<Record<string, string | number | boolean>>}
		*/
		getDiagnostics() {
			return Object.freeze({
				algorithm: this.algorithm,
				backend: "fallback",
				finalized: this._finalized,
				bytesHashedHigh: this._bytesHigh,
				bytesHashedLow: this._bytesLow,
				blocksProcessed: this._blocksProcessed,
				bufferedBytes: this._blockLength,
				peakBufferedBytes: this._peakBufferedBytes
			});
		}
		_addLength(length) {
			const highAddition = Math.floor(length / 4294967296);
			const lowAddition = length >>> 0;
			const previousLow = this._bytesLow;
			this._bytesLow = this._bytesLow + lowAddition >>> 0;
			this._bytesHigh = this._bytesHigh + highAddition + (this._bytesLow < previousLow ? 1 : 0) >>> 0;
		}
	};
	/** Incremental pure-JavaScript SHA-1. SHA-1 exists only for legacy provider compatibility. */
	var Sha1 = class extends IncrementalHash {
		algorithm = "SHA-1";
		_initialize() {
			this._state = new Uint32Array([
				1732584193,
				4023233417,
				2562383102,
				271733878,
				3285377520
			]);
			this._words = /* @__PURE__ */ new Uint32Array(80);
		}
		_compress(bytes, offset) {
			const words = this._words;
			for (let index = 0; index < 16; index += 1) {
				const start = offset + index * 4;
				words[index] = (bytes[start] << 24 | bytes[start + 1] << 16 | bytes[start + 2] << 8 | bytes[start + 3]) >>> 0;
			}
			for (let index = 16; index < 80; index += 1) words[index] = rotl(words[index - 3] ^ words[index - 8] ^ words[index - 14] ^ words[index - 16], 1);
			let [a, b, c, d, e] = this._state;
			for (let index = 0; index < 80; index += 1) {
				let f;
				let k;
				if (index < 20) {
					f = b & c | ~b & d;
					k = 1518500249;
				} else if (index < 40) {
					f = b ^ c ^ d;
					k = 1859775393;
				} else if (index < 60) {
					f = b & c | b & d | c & d;
					k = 2400959708;
				} else {
					f = b ^ c ^ d;
					k = 3395469782;
				}
				const temporary = rotl(a, 5) + f + e + k + words[index] >>> 0;
				e = d;
				d = c;
				c = rotl(b, 30);
				b = a;
				a = temporary;
			}
			this._state[0] = this._state[0] + a >>> 0;
			this._state[1] = this._state[1] + b >>> 0;
			this._state[2] = this._state[2] + c >>> 0;
			this._state[3] = this._state[3] + d >>> 0;
			this._state[4] = this._state[4] + e >>> 0;
		}
		_serialize() {
			const output = /* @__PURE__ */ new Uint8Array(20);
			const view = new DataView(output.buffer);
			this._state.forEach((word, index) => view.setUint32(index * 4, word, false));
			return output;
		}
	};
	const SHA256_INITIAL = [
		1779033703,
		3144134277,
		1013904242,
		2773480762,
		1359893119,
		2600822924,
		528734635,
		1541459225
	];
	const SHA256_K = new Uint32Array([
		1116352408,
		1899447441,
		3049323471,
		3921009573,
		961987163,
		1508970993,
		2453635748,
		2870763221,
		3624381080,
		310598401,
		607225278,
		1426881987,
		1925078388,
		2162078206,
		2614888103,
		3248222580,
		3835390401,
		4022224774,
		264347078,
		604807628,
		770255983,
		1249150122,
		1555081692,
		1996064986,
		2554220882,
		2821834349,
		2952996808,
		3210313671,
		3336571891,
		3584528711,
		113926993,
		338241895,
		666307205,
		773529912,
		1294757372,
		1396182291,
		1695183700,
		1986661051,
		2177026350,
		2456956037,
		2730485921,
		2820302411,
		3259730800,
		3345764771,
		3516065817,
		3600352804,
		4094571909,
		275423344,
		430227734,
		506948616,
		659060556,
		883997877,
		958139571,
		1322822218,
		1537002063,
		1747873779,
		1955562222,
		2024104815,
		2227730452,
		2361852424,
		2428436474,
		2756734187,
		3204031479,
		3329325298
	]);
	/** Incremental pure-JavaScript SHA-256. */
	var Sha256 = class extends IncrementalHash {
		algorithm = "SHA-256";
		_initialize() {
			this._state = new Uint32Array(SHA256_INITIAL);
			this._words = /* @__PURE__ */ new Uint32Array(64);
		}
		_compress(bytes, offset) {
			const words = this._words;
			for (let index = 0; index < 16; index += 1) {
				const start = offset + index * 4;
				words[index] = (bytes[start] << 24 | bytes[start + 1] << 16 | bytes[start + 2] << 8 | bytes[start + 3]) >>> 0;
			}
			for (let index = 16; index < 64; index += 1) {
				const x = words[index - 15];
				const y = words[index - 2];
				const s0 = rotr(x, 7) ^ rotr(x, 18) ^ x >>> 3;
				const s1 = rotr(y, 17) ^ rotr(y, 19) ^ y >>> 10;
				words[index] = words[index - 16] + s0 + words[index - 7] + s1 >>> 0;
			}
			let [a, b, c, d, e, f, g, h] = this._state;
			for (let index = 0; index < 64; index += 1) {
				const sigma1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
				const choice = e & f ^ ~e & g;
				const t1 = h + sigma1 + choice + SHA256_K[index] + words[index] >>> 0;
				const t2 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + (a & b ^ a & c ^ b & c) >>> 0;
				h = g;
				g = f;
				f = e;
				e = d + t1 >>> 0;
				d = c;
				c = b;
				b = a;
				a = t1 + t2 >>> 0;
			}
			this._state[0] = this._state[0] + a >>> 0;
			this._state[1] = this._state[1] + b >>> 0;
			this._state[2] = this._state[2] + c >>> 0;
			this._state[3] = this._state[3] + d >>> 0;
			this._state[4] = this._state[4] + e >>> 0;
			this._state[5] = this._state[5] + f >>> 0;
			this._state[6] = this._state[6] + g >>> 0;
			this._state[7] = this._state[7] + h >>> 0;
		}
		_serialize() {
			const output = /* @__PURE__ */ new Uint8Array(32);
			const view = new DataView(output.buffer);
			this._state.forEach((word, index) => view.setUint32(index * 4, word, false));
			return output;
		}
	};
	function nativeSubtle() {
		try {
			const subtle = globalThis.crypto?.subtle;
			const digest = subtle?.digest;
			return subtle && typeof digest === "function" ? {
				subtle,
				digest
			} : null;
		} catch {
			return null;
		}
	}
	async function hashHex(algorithm, input, options) {
		const bytes = bytesOf(input);
		let backend = "auto";
		try {
			if (options !== void 0) {
				if (options === null || typeof options !== "object") throw new TypeError("Hash options must be an object");
				backend = options.backend ?? "auto";
			}
		} catch (error) {
			if (error instanceof TypeError) throw error;
			throw new TypeError("Hash options could not be read");
		}
		if (!BACKENDS.has(backend)) throw new RangeError("Hash backend must be auto, native, or fallback");
		const subtle = nativeSubtle();
		if (backend !== "fallback" && subtle) {
			const snapshot = bytes.slice();
			try {
				const digest = new Uint8Array(await subtle.digest.call(subtle.subtle, algorithm, snapshot));
				const expectedLength = algorithm === "SHA-1" ? 20 : 32;
				if (digest.byteLength !== expectedLength) throw new Error(`Native ${algorithm} returned an invalid digest length`);
				return lowerHex(digest);
			} catch (error) {
				if (backend === "native") throw error;
				return (algorithm === "SHA-1" ? new Sha1() : new Sha256()).update(snapshot).digestHex();
			}
		}
		if (backend === "native") throw new Error(`Native ${algorithm} is unavailable in this context`);
		return (algorithm === "SHA-1" ? new Sha1() : new Sha256()).update(bytes).digestHex();
	}
	/**
	* Hash input to lowercase SHA-256 hex, preferring exact native WebCrypto when available.
	* @param {HashInput} input
	* @param {HashOptions} [options]
	* @returns {Promise<string>}
	*/
	function sha256Hex$1(input, options) {
		return hashHex("SHA-256", input, options);
	}
	//#endregion
	//#region ../aerobeat-web-content-authoring/src/canonical.js
	/**
	* Deterministically serialize JSON-compatible data with lexically sorted object keys.
	* Undefined, functions, symbols, accessors, cycles and non-finite numbers are rejected.
	*
	* @param {unknown} value
	* @returns {string}
	*/
	function canonicalJson(value) {
		return serialize(value, /* @__PURE__ */ new Set());
	}
	/**
	* @param {unknown} value
	* @param {Set<object>} seen
	* @returns {string}
	*/
	function serialize(value, seen) {
		if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
		if (typeof value === "number") {
			if (!Number.isFinite(value)) throw new TypeError("Canonical JSON rejects non-finite numbers");
			return JSON.stringify(Object.is(value, -0) ? 0 : value);
		}
		if (Array.isArray(value)) {
			if (Object.getPrototypeOf(value) !== Array.prototype) throw new TypeError("Canonical JSON accepts ordinary arrays only");
			if (seen.has(value)) throw new TypeError("Canonical JSON rejects cycles");
			if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || key !== "length" && (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length))) throw new TypeError("Canonical JSON rejects extended arrays");
			seen.add(value);
			const parts = [];
			for (let index = 0; index < value.length; index += 1) {
				const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
				if (!descriptor?.enumerable || !("value" in descriptor) || descriptor.value === void 0) throw new TypeError("Canonical JSON rejects sparse arrays, accessors and undefined values");
				parts.push(serialize(descriptor.value, seen));
			}
			seen.delete(value);
			return `[${parts.join(",")}]`;
		}
		if (!isPlainRecord(value)) throw new TypeError("Canonical JSON accepts plain data records only");
		if (seen.has(value)) throw new TypeError("Canonical JSON rejects cycles");
		seen.add(value);
		const keys = Reflect.ownKeys(value);
		if (keys.some((key) => typeof key !== "string")) throw new TypeError("Canonical JSON rejects symbol keys");
		const stringKeys = keys;
		stringKeys.sort();
		const parts = [];
		for (const key of stringKeys) {
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (!descriptor?.enumerable || !("value" in descriptor) || descriptor.value === void 0) throw new TypeError("Canonical JSON rejects accessors and undefined values");
			parts.push(`${JSON.stringify(key)}:${serialize(descriptor.value, seen)}`);
		}
		seen.delete(value);
		return `{${parts.join(",")}}`;
	}
	/**
	* @param {unknown} value
	* @returns {value is Record<string, unknown>}
	*/
	function isPlainRecord(value) {
		if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
		const prototype = Object.getPrototypeOf(value);
		return prototype === Object.prototype || prototype === null;
	}
	/**
	* @param {string | Uint8Array} value
	* @returns {Promise<string>}
	*/
	async function sha256Hex(value) {
		return sha256Hex$1(value);
	}
	/**
	* @param {string | Uint8Array} value
	* @returns {Promise<string>}
	*/
	async function prefixedSha256(value) {
		return `sha256:${await sha256Hex(value)}`;
	}
	/**
	* @param {unknown} value
	* @returns {unknown}
	*/
	function cloneData(value) {
		return globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
	}
	/**
	* @template T
	* @param {T} value
	* @returns {T}
	*/
	function deepFreeze(value) {
		if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
		if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
			Object.freeze(value);
			for (const key of Reflect.ownKeys(value)) {
				const descriptor = Object.getOwnPropertyDescriptor(value, key);
				if (descriptor && "value" in descriptor) deepFreeze(descriptor.value);
			}
		}
		return value;
	}
	//#endregion
	//#region ../aerobeat-web-content-authoring/src/converter-profile.js
	const converterProfileClass = "converter_regeneration";
	deepFreeze({
		schema: "aerobeat/prototype_profile",
		version: 1,
		profileId: "aero.converter.canonical",
		profileVersion: "1.0.0",
		class: converterProfileClass,
		label: "Canonical Converter (Experimental)",
		experimental: true,
		settings: {
			guardRelocationRadius: 1,
			reachAllowanceSubcells: 0
		},
		contentHash: "a43b53a39c13c9e9efe59854aee0fa16efdcd3c6a29bc09f678d94b3fd8f0202"
	});
	deepFreeze({
		schema: "aerobeat/prototype_profile",
		version: 1,
		profileId: "aero.converter.prototype-reach",
		profileVersion: "1.0.0",
		class: converterProfileClass,
		label: "Prototype Reach Converter (Experimental)",
		experimental: true,
		settings: {
			guardRelocationRadius: 2,
			reachAllowanceSubcells: 1
		},
		contentHash: "e37f8b527ed5ce86738ce22007fc963f83bccd737893fb4728d3b83eaa044eea"
	});
	/**
	* Normalize and cryptographically verify one exact experimental converter profile.
	* The label is display-only; identity hashes exact schema/version/id/version/class/settings.
	*
	* @param {unknown} value
	*/
	async function normalizeConverterProfile(value) {
		if (!exactKeys(value, [
			"schema",
			"version",
			"profileId",
			"profileVersion",
			"class",
			"label",
			"experimental",
			"settings",
			"contentHash"
		])) throw profileError("converter_profile_invalid", "Converter profile must contain the exact bounded profile fields");
		const record = value;
		if (record.schema !== "aerobeat/prototype_profile" || record.version !== 1 || record.class !== "converter_regeneration" || record.experimental !== true) throw profileError("converter_profile_invalid", "Converter profile schema, version, class and experimental truth are required");
		const profileId = boundedString$1(record.profileId, "profileId", 128);
		const profileVersion = boundedString$1(record.profileVersion, "profileVersion", 64);
		const label = boundedString$1(record.label, "label", 256);
		if (!exactKeys(record.settings, ["guardRelocationRadius", "reachAllowanceSubcells"])) throw profileError("converter_profile_settings_invalid", "Converter profile settings must contain the exact supported fields");
		const sourceSettings = record.settings;
		const settings = deepFreeze({
			guardRelocationRadius: boundedInteger(sourceSettings.guardRelocationRadius, "guardRelocationRadius", 0, 8),
			reachAllowanceSubcells: boundedInteger(sourceSettings.reachAllowanceSubcells, "reachAllowanceSubcells", 0, 8)
		});
		const hashBody = deepFreeze({
			schema: "aerobeat/prototype_profile",
			version: 1,
			profileId,
			profileVersion,
			class: converterProfileClass,
			settings
		});
		const contentHash = await sha256Hex(canonicalJson(hashBody));
		if (record.contentHash !== contentHash) throw profileError("converter_profile_hash_mismatch", "Converter profile content hash does not match its canonical identity and settings");
		return deepFreeze({
			...hashBody,
			label,
			experimental: true,
			contentHash
		});
	}
	/** @param {unknown} value @param {readonly string[]} keys */
	function exactKeys(value, keys) {
		if (!isPlainRecord(value) || Reflect.ownKeys(value).length !== keys.length) return false;
		return keys.every((key) => {
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			return descriptor && "value" in descriptor && descriptor.enumerable && descriptor.value !== void 0;
		});
	}
	/** @param {unknown} value @param {string} field @param {number} maximum */
	function boundedString$1(value, field, maximum) {
		if (typeof value !== "string" || !value || value.length > maximum) throw profileError("converter_profile_invalid", `${field} must be a bounded non-empty string`);
		return value;
	}
	/** @param {unknown} value @param {string} field @param {number} minimum @param {number} maximum */
	function boundedInteger(value, field, minimum, maximum) {
		if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) throw profileError("converter_profile_settings_invalid", `${field} must be an integer from ${minimum} through ${maximum}`);
		return Number(value);
	}
	/** @param {string} code @param {string} message */
	function profileError(code, message) {
		const error = new Error(message);
		error.name = "AeroConverterProfileError";
		Object.assign(error, { code });
		return error;
	}
	//#endregion
	//#region ../aerobeat-web-content-authoring/src/beatmap.js
	/** @typedef {"v2" | "v3" | "v4"} BeatMapFormat */
	/**
	* Parse and narrow one Beat Saber Standard difficulty document.
	* Normalized x/y and cell values retain Beat Saber's bottom-left source convention;
	* canonical top-left AeroBeat cells are derived exactly once by target emitters.
	*
	* @param {Uint8Array | string} input
	* @param {BeatMapFormat} format
	* @returns {Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>}
	*/
	function parseBeatMapDifficulty(input, format) {
		const text = typeof input === "string" ? input : new TextDecoder("utf-8", { fatal: true }).decode(input);
		let parsed;
		try {
			parsed = JSON.parse(text);
		} catch (cause) {
			throw new AuthoringParseError("difficulty_json_invalid", `Difficulty JSON could not be parsed${diagnostic(cause)}`);
		}
		if (!isPlainRecord(parsed)) throw new AuthoringParseError("difficulty_shape_invalid", "Difficulty root must be a plain record");
		if (format === "v4") return freezeSummary(normalizeV4(parsed));
		if (format === "v2") return freezeSummary(normalizeV2(parsed));
		return freezeSummary(normalizeV3(parsed));
	}
	/** @param {Record<string, unknown>} map */
	function normalizeV2(map) {
		const notes = array(map._notes ?? map.notes);
		const colorNotes = [];
		const bombNotes = [];
		let colorIndex = 0;
		for (const entry of notes) {
			if (!isPlainRecord(entry)) continue;
			const type = integer(entry._type ?? entry.type, -1);
			const x = integer(entry._lineIndex ?? entry.lineIndex, 0);
			const y = integer(entry._lineLayer ?? entry.lineLayer, 0);
			if (type === 0 || type === 1) colorNotes.push(noteRecord(colorIndex++, number(entry._time ?? entry.b, 0), x, y, type, integer(entry._cutDirection ?? entry.cutDirection, 8), 0, false));
			else if (type === 3) bombNotes.push({
				start: number(entry._time ?? entry.b, 0),
				x,
				y,
				cell: cellFromXY(x, y)
			});
		}
		return {
			colorNotes,
			bombNotes,
			obstacles: obstacleArray(map, "_obstacles", "obstacles").map((entry, sourceIndex) => normalizeV2Obstacle(entry, sourceIndex)),
			sliders: array(map._sliders ?? map.sliders).flatMap((entry) => isPlainRecord(entry) ? [{
				start: number(entry._headTime ?? entry.b, 0),
				end: number(entry._tailTime ?? entry.tb ?? entry._headTime ?? entry.b, 0),
				cell: cellFromXY(integer(entry._headLineIndex ?? entry.x, 0), integer(entry._headLineLayer ?? entry.y, 0)),
				tailCell: cellFromXY(integer(entry._tailLineIndex ?? entry.tx, 0), integer(entry._tailLineLayer ?? entry.ty, 0)),
				hand: handFromColor(integer(entry._colorType ?? entry.c, 0)),
				direction: integer(entry._headCutDirection ?? entry.d, 8),
				tailDirection: integer(entry._tailCutDirection ?? entry.tc ?? entry._headCutDirection ?? entry.d, 8),
				headCurveMultiplier: number(entry._headControlPointLengthMultiplier ?? entry.mu, 1),
				tailCurveMultiplier: number(entry._tailControlPointLengthMultiplier ?? entry.tmu, 1),
				midAnchorMode: integer(entry._sliderMidAnchorMode ?? entry.m, 0)
			}] : []),
			burstSliders: []
		};
	}
	/** @param {Record<string, unknown>} map */
	function normalizeV3(map) {
		return {
			colorNotes: array(map.colorNotes).flatMap((entry, sourceIndex) => {
				if (!isPlainRecord(entry)) return [];
				const x = integer(entry.x, 0);
				const y = integer(entry.y, 0);
				const color = integer(entry.c, 0);
				return [noteRecord(sourceIndex, number(entry.b, 0), x, y, color, integer(entry.d, 8), number(entry.a, 0), Object.hasOwn(entry, "a"))];
			}),
			bombNotes: array(map.bombNotes).flatMap((entry) => isPlainRecord(entry) ? [{
				start: number(entry.b, 0),
				x: integer(entry.x, 0),
				y: integer(entry.y, 0),
				cell: cellFromXY(integer(entry.x, 0), integer(entry.y, 0))
			}] : []),
			obstacles: obstacleArray(map, "obstacles").map((entry, sourceIndex) => normalizeInlineObstacle(entry, sourceIndex)),
			sliders: array(map.sliders).flatMap((entry) => isPlainRecord(entry) ? [{
				start: number(entry.b, 0),
				end: number(entry.tb ?? entry.b, 0),
				cell: cellFromXY(integer(entry.x, 0), integer(entry.y, 0)),
				tailCell: cellFromXY(integer(entry.tx, 0), integer(entry.ty, 0)),
				hand: handFromColor(integer(entry.c, 0)),
				direction: integer(entry.d, 8),
				tailDirection: integer(entry.tc ?? entry.d, 8),
				headCurveMultiplier: number(entry.mu, 1),
				tailCurveMultiplier: number(entry.tmu, 1),
				midAnchorMode: integer(entry.m, 0)
			}] : []),
			burstSliders: array(map.burstSliders).flatMap((entry) => {
				if (!isPlainRecord(entry)) return [];
				const result = {
					start: number(entry.b, 0),
					end: number(entry.tb ?? entry.b, 0),
					cell: cellFromXY(integer(entry.x, 0), integer(entry.y, 0)),
					tailCell: cellFromXY(integer(entry.tx, 0), integer(entry.ty, 0)),
					hand: handFromColor(integer(entry.c, 0)),
					direction: integer(entry.d, 8),
					sliceCount: Math.max(integer(entry.sc, 1), 1)
				};
				if (Object.hasOwn(entry, "s")) Object.assign(result, { spacingBias: number(entry.s, 0) });
				return [result];
			})
		};
	}
	/** @param {Record<string, unknown>} map */
	function normalizeV4(map) {
		const noteData = records(map.colorNotesData);
		const colorNotes = array(map.colorNotes).flatMap((entry, sourceIndex) => {
			if (!isPlainRecord(entry)) return [];
			const metadata = metadataAt(noteData, integer(entry.i, -1));
			const x = intField(entry, metadata, "x", 0);
			const y = intField(entry, metadata, "y", 0);
			const color = intField(entry, metadata, "c", 0);
			return [noteRecord(sourceIndex, number(entry.b, 0), x, y, color, intField(entry, metadata, "d", 8), floatField(entry, metadata, "a", 0), Object.hasOwn(entry, "a") || Object.hasOwn(metadata, "a"))];
		});
		const bombData = records(map.bombNotesData);
		const bombNotes = array(map.bombNotes).flatMap((entry) => {
			if (!isPlainRecord(entry)) return [];
			const metadata = metadataAt(bombData, integer(entry.i, -1));
			const x = intField(entry, metadata, "x", 0);
			const y = intField(entry, metadata, "y", 0);
			return [{
				start: number(entry.b, 0),
				x,
				y,
				cell: cellFromXY(x, y)
			}];
		});
		const obstacleData = array(map.obstaclesData);
		const obstacles = obstacleArray(map, "obstacles").map((entry, sourceIndex) => normalizeIndexedObstacle(entry, obstacleData, sourceIndex));
		const arcData = records(map.arcsData);
		const sliders = array(map.arcs).flatMap((entry) => {
			if (!isPlainRecord(entry)) return [];
			const head = metadataAt(noteData, integer(entry.hi, -1));
			const tail = metadataAt(noteData, integer(entry.ti, -1));
			const metadata = metadataAt(arcData, integer(entry.ai, -1));
			return [{
				start: number(entry.hb, 0),
				end: number(entry.tb ?? entry.hb, 0),
				cell: cellFromXY(intField(head, {}, "x", 0), intField(head, {}, "y", 0)),
				tailCell: cellFromXY(intField(tail, {}, "x", 0), intField(tail, {}, "y", 0)),
				hand: handFromColor(intField(head, {}, "c", 0)),
				direction: intField(head, {}, "d", 8),
				tailDirection: intField(tail, {}, "d", 8),
				headCurveMultiplier: floatField(metadata, {}, "m", 1),
				tailCurveMultiplier: floatField(metadata, {}, "tm", 1),
				midAnchorMode: intField(metadata, {}, "a", 0)
			}];
		});
		const chainData = records(map.chainsData);
		return {
			colorNotes,
			bombNotes,
			obstacles,
			sliders,
			burstSliders: array(map.chains).flatMap((entry) => {
				if (!isPlainRecord(entry)) return [];
				const head = metadataAt(noteData, integer(entry.i, -1));
				const metadata = metadataAt(chainData, integer(entry.ci, -1));
				const result = {
					start: number(entry.hb, 0),
					end: number(entry.tb ?? entry.hb, 0),
					cell: cellFromXY(intField(head, {}, "x", 0), intField(head, {}, "y", 0)),
					tailCell: cellFromXY(intField(metadata, {}, "tx", 0), intField(metadata, {}, "ty", 0)),
					hand: handFromColor(intField(head, {}, "c", 0)),
					direction: intField(head, {}, "d", 8),
					sliceCount: Math.max(intField(metadata, {}, "c", 1), 1)
				};
				if (Object.hasOwn(metadata, "s")) Object.assign(result, { spacingBias: number(metadata.s, 0) });
				return [result];
			})
		};
	}
	/** @param {unknown} value @param {number} sourceIndex */
	function normalizeV2Obstacle(value, sourceIndex) {
		if (!isPlainRecord(value)) throw new AuthoringParseError("obstacle_shape_invalid", "v2 obstacle must be a plain record");
		const type = requiredInteger(value, ["_type", "type"], "obstacle_type_unsupported");
		if (type !== 0 && type !== 1) throw new AuthoringParseError("obstacle_type_unsupported", "v2 obstacle type must be 0 or 1");
		return obstacleRecord(requiredFinite(value, ["_time", "b"], "obstacle_time_invalid"), requiredFinite(value, ["_duration", "d"], "obstacle_duration_invalid"), requiredInteger(value, ["_lineIndex", "x"], "obstacle_geometry_invalid"), type === 1 ? 2 : 0, requiredInteger(value, ["_width", "w"], "obstacle_geometry_invalid"), type === 1 ? 3 : 5, sourceIndex);
	}
	/** @param {unknown} value @param {number} sourceIndex */
	function normalizeInlineObstacle(value, sourceIndex) {
		if (!isPlainRecord(value)) throw new AuthoringParseError("obstacle_shape_invalid", "v3 obstacle must be a plain record");
		rejectObstacleRotation(value);
		return obstacleRecord(requiredFinite(value, ["b"], "obstacle_time_invalid"), requiredFinite(value, ["d"], "obstacle_duration_invalid"), requiredInteger(value, ["x"], "obstacle_geometry_invalid"), requiredInteger(value, ["y"], "obstacle_geometry_invalid"), requiredInteger(value, ["w"], "obstacle_geometry_invalid"), requiredInteger(value, ["h"], "obstacle_geometry_invalid"), sourceIndex);
	}
	/** @param {unknown} value @param {unknown[]} obstacleData @param {number} sourceIndex */
	function normalizeIndexedObstacle(value, obstacleData, sourceIndex) {
		if (!isPlainRecord(value)) throw new AuthoringParseError("obstacle_shape_invalid", "v4 obstacle must be a plain record");
		const index = requiredInteger(value, ["i"], "obstacle_index_invalid");
		if (index < 0 || index >= obstacleData.length || !isPlainRecord(obstacleData[index])) throw new AuthoringParseError("obstacle_index_invalid", "v4 obstacle metadata index is missing or out of range");
		for (const field of [
			"d",
			"x",
			"y",
			"w",
			"h"
		]) if (Object.hasOwn(value, field)) throw new AuthoringParseError("obstacle_geometry_conflict", "v4 obstacle geometry must come only from obstaclesData");
		const metadata = obstacleData[index];
		rejectObstacleRotation(value);
		rejectObstacleRotation(metadata);
		return obstacleRecord(requiredFinite(value, ["b"], "obstacle_time_invalid"), requiredFinite(metadata, ["d"], "obstacle_duration_invalid"), requiredInteger(metadata, ["x"], "obstacle_geometry_invalid"), requiredInteger(metadata, ["y"], "obstacle_geometry_invalid"), requiredInteger(metadata, ["w"], "obstacle_geometry_invalid"), requiredInteger(metadata, ["h"], "obstacle_geometry_invalid"), sourceIndex);
	}
	/** @param {Record<string, unknown>} value */
	function rejectObstacleRotation(value) {
		if (Object.hasOwn(value, "r") && value.r !== 0) throw new AuthoringParseError("obstacle_rotation_unsupported", "Rotated Flow obstacle geometry is unsupported");
	}
	/** @param {number} start @param {number} duration @param {number} x @param {number} y @param {number} width @param {number} height @param {number} sourceIndex */
	function obstacleRecord(start, duration, x, y, width, height, sourceIndex) {
		if (start < 0) throw new AuthoringParseError("obstacle_time_invalid", "Obstacle start must be non-negative");
		if (!(duration > 0) || !Number.isFinite(start + duration)) throw new AuthoringParseError("obstacle_duration_invalid", "Obstacle duration must be finite and positive");
		if (x < 0 || x > 3 || y < 0 || y > 2 || width < 1 || width > 4 || height < 1 || height > 5 || x + width > 4 || y + height > 5) throw new AuthoringParseError("obstacle_geometry_invalid", "Obstacle geometry is outside Beat Saber lane/layer bounds");
		return {
			start,
			duration,
			x,
			y,
			width,
			height,
			sourceIndex
		};
	}
	/** @param {Record<string, unknown>} value @param {string[]} keys @param {string} code */
	function requiredFinite(value, keys, code) {
		for (const key of keys) if (Object.hasOwn(value, key)) {
			const candidate = value[key];
			if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
			break;
		}
		throw new AuthoringParseError(code, `Required finite obstacle field ${keys[0]} is invalid`);
	}
	/** @param {Record<string, unknown>} value @param {string[]} keys @param {string} code */
	function requiredInteger(value, keys, code) {
		const candidate = requiredFinite(value, keys, code);
		if (!Number.isInteger(candidate)) throw new AuthoringParseError(code, `Required integer obstacle field ${keys[0]} is invalid`);
		return candidate;
	}
	/** @param {number} sourceIndex @param {number} start @param {number} x @param {number} y @param {number} color @param {number} direction @param {number} angleOffset @param {boolean} hasAngleOffset */
	function noteRecord(sourceIndex, start, x, y, color, direction, angleOffset, hasAngleOffset) {
		return {
			sourceIndex,
			start,
			x,
			y,
			cell: cellFromXY(x, y),
			color,
			hand: handFromColor(color),
			direction,
			angleOffset,
			hasAngleOffset
		};
	}
	/** @param {number} x @param {number} y */
	function cellFromXY(x, y) {
		return clampInt(y, 0, 2) * 4 + clampInt(x, 0, 3);
	}
	/** @param {number} color */
	function handFromColor(color) {
		return color === 0 ? "left" : "right";
	}
	/** @param {Record<string, unknown>} map @param {string} field @param {string} [fallbackField] @returns {unknown[]} */
	function obstacleArray(map, field, fallbackField) {
		const selectedField = Object.hasOwn(map, field) ? field : fallbackField && Object.hasOwn(map, fallbackField) ? fallbackField : "";
		if (!selectedField) return [];
		const value = map[selectedField];
		if (!Array.isArray(value)) throw new AuthoringParseError("obstacle_container_invalid", `${selectedField} must be an array when present`);
		return value;
	}
	/** @param {unknown} value */
	function array(value) {
		return Array.isArray(value) ? value : [];
	}
	/** @param {unknown} value */
	function records(value) {
		return array(value).filter(isPlainRecord);
	}
	/** @param {Record<string, unknown>[]} recordsValue @param {number} index */
	function metadataAt(recordsValue, index) {
		return index < 0 || index >= recordsValue.length ? {} : recordsValue[index];
	}
	/** @param {Record<string, unknown>} primary @param {Record<string, unknown>} fallback @param {string} key @param {number} defaultValue */
	function intField(primary, fallback, key, defaultValue) {
		return integer(Object.hasOwn(primary, key) ? primary[key] : fallback[key], defaultValue);
	}
	/** @param {Record<string, unknown>} primary @param {Record<string, unknown>} fallback @param {string} key @param {number} defaultValue */
	function floatField(primary, fallback, key, defaultValue) {
		return number(Object.hasOwn(primary, key) ? primary[key] : fallback[key], defaultValue);
	}
	/** @param {unknown} value @param {number} fallback */
	function number(value, fallback) {
		return typeof value === "number" && Number.isFinite(value) ? value : fallback;
	}
	/** @param {unknown} value @param {number} fallback */
	function integer(value, fallback) {
		return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
	}
	/** @param {number} value @param {number} minimum @param {number} maximum */
	function clampInt(value, minimum, maximum) {
		return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
	}
	/** @param {Record<string, readonly Readonly<Record<string, unknown>>[]>} summary */
	function freezeSummary(summary) {
		for (const values of Object.values(summary)) {
			for (const value of values) Object.freeze(value);
			Object.freeze(values);
		}
		return Object.freeze(summary);
	}
	/** @param {unknown} cause */
	function diagnostic(cause) {
		return cause instanceof Error && cause.message ? `: ${cause.message}` : "";
	}
	var AuthoringParseError = class extends Error {
		/** @param {string} code @param {string} message */
		constructor(code, message) {
			super(message);
			this.name = "AuthoringParseError";
			this.code = code;
		}
	};
	//#endregion
	//#region ../aerobeat-web-content-authoring/src/definitions.js
	const boxingPrototypeContractId = "aerobeat.boxing.prototype.v1";
	const rowFamilyRecipeId = "row_family_balanced_height_v1";
	const cutFamilyRecipeId = "cut_family_source_height_v1";
	const semanticTrackRulesetId = "boxing_semantic_track_v1";
	const spatialGridRulesetId = "boxing_spatial_grid_v1";
	const recipeVersion = "1.0.0";
	const rulesetVersion = "1.0.0";
	const guardPairs = deepFreeze([
		[0, 1],
		[1, 2],
		[2, 3],
		[4, 5],
		[5, 6],
		[6, 7],
		[8, 9],
		[9, 10],
		[10, 11]
	]);
	const reachSubcellsPerBeat = deepFreeze({
		Easy: 3,
		Normal: 3.5,
		Hard: 4,
		Expert: 5,
		ExpertPlus: 6
	});
	const recipeDefinitions = deepFreeze([{
		contractId: boxingPrototypeContractId,
		recipeId: rowFamilyRecipeId,
		version: recipeVersion,
		label: "Row Family / Balanced Height",
		familyRule: {
			top: "uppercut",
			middle: "straight",
			bottom: "hook"
		},
		heightRule: "balance_generated_rows",
		punchMinSpacingMs: 360,
		guardTimingWindowMs: 180,
		obstacleTimingWindowMs: 180,
		freshnessMs: 150,
		straightQualificationMs: 100,
		reachSubcellsPerBeat,
		initialWristCells: {
			left: 5,
			right: 6
		}
	}, {
		contractId: boxingPrototypeContractId,
		recipeId: cutFamilyRecipeId,
		version: recipeVersion,
		label: "Cut Family / Source Height",
		familyRule: {
			up: "uppercut",
			horizontal: "hook",
			other: "straight"
		},
		heightRule: "prefer_source_row_promote_bottom_uppercut",
		normalizeOutwardHooks: true,
		punchMinSpacingMs: 360,
		guardTimingWindowMs: 180,
		obstacleTimingWindowMs: 180,
		freshnessMs: 150,
		straightQualificationMs: 100,
		reachSubcellsPerBeat,
		initialWristCells: {
			left: 5,
			right: 6
		}
	}]);
	const rulesetDefinitions = deepFreeze([{
		contractId: boxingPrototypeContractId,
		rulesetId: semanticTrackRulesetId,
		version: rulesetVersion,
		timingWindowMs: 180,
		evidenceFreshnessMs: 150,
		straightQualificationMs: 100,
		hookAndUppercutQualification: "target-cell-and-cardinal-direction",
		semanticClassifiers: "authoritative"
	}, {
		contractId: boxingPrototypeContractId,
		rulesetId: spatialGridRulesetId,
		version: rulesetVersion,
		timingWindowMs: 180,
		evidenceFreshnessMs: 150,
		straightQualificationMs: 100,
		hookAndUppercutQualification: "target-cell-and-cardinal-direction",
		semanticClassifiers: "shadow-only",
		subgrid: {
			columns: 8,
			rows: 6,
			cellOrder: "top-left-row-major"
		}
	}]);
	const supportedModifiers = deepFreeze([
		"no_squats",
		"no_weaves",
		"any_punch",
		"crossed_guard",
		"cross_body"
	]);
	//#endregion
	//#region ../aerobeat-web-contracts/src/contract-guards.js
	/**
	* @param {unknown} value
	* @returns {value is Readonly<Record<string, unknown>>}
	*/
	function isRecord(value) {
		if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
		const prototype = Object.getPrototypeOf(value);
		return prototype === Object.prototype || prototype === null;
	}
	/**
	* Require a plain record to contain exactly the declared own enumerable keys.
	* Payload records remain the versioned extension point; contract envelopes do not.
	*
	* @param {unknown} value
	* @param {readonly string[]} expectedKeys
	* @returns {value is Readonly<Record<string, unknown>>}
	*/
	function hasExactKeys(value, expectedKeys) {
		if (!isRecord(value)) return false;
		const keys = Reflect.ownKeys(value);
		return keys.length === expectedKeys.length && keys.every((key) => {
			if (typeof key !== "string" || !expectedKeys.includes(key)) return false;
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			return descriptor !== void 0 && descriptor.enumerable && "value" in descriptor;
		});
	}
	//#endregion
	//#region ../aerobeat-web-contracts/src/flow-obstacle-contracts.js
	/**
	* Continuous Beat Saber lane/layer obstacle geometry. This record is the sole
	* Flow render and collision authority. `gridMask` is always derived from it.
	*
	* @typedef {Object} AeroFlowObstacleGeometry
	* @property {"aerobeat/flow_obstacle_geometry"} schema Schema ID.
	* @property {1} version Schema version.
	* @property {"beatsaber_lane_layer"} coordinateSpace Source coordinate space.
	* @property {number} x Integer left-most lane, 0..3.
	* @property {number} y Integer bottom-most source layer, 0..2.
	* @property {number} width Integer continuous lane width, 1..4.
	* @property {number} height Integer continuous layer height, 1..5.
	*/
	/**
	* @param {unknown} value
	* @returns {value is AeroFlowObstacleGeometry}
	*/
	function isFlowObstacleGeometry(value) {
		if (!hasExactKeys(value, [
			"schema",
			"version",
			"coordinateSpace",
			"x",
			"y",
			"width",
			"height"
		])) return false;
		return value.schema === "aerobeat/flow_obstacle_geometry" && value.version === 1 && value.coordinateSpace === "beatsaber_lane_layer" && typeof value.x === "number" && Number.isInteger(value.x) && value.x >= 0 && value.x <= 3 && typeof value.y === "number" && Number.isInteger(value.y) && value.y >= 0 && value.y <= 2 && typeof value.width === "number" && Number.isInteger(value.width) && value.width >= 1 && value.width <= 4 && typeof value.height === "number" && Number.isInteger(value.height) && value.height >= 1 && value.height <= 5 && value.x + value.width <= 4 && value.y + value.height <= 5;
	}
	/**
	* Derive the unique sorted top-left row-major 4x3 mask used only for bounded
	* UI/indexing and Boxing feasibility. Rendering and Flow collision must use
	* continuous geometry instead.
	*
	* @param {AeroFlowObstacleGeometry} geometry
	* @returns {readonly number[]}
	*/
	function deriveFlowObstacleGridMask(geometry) {
		if (!isFlowObstacleGeometry(geometry)) throw new TypeError("flow_obstacle_geometry_invalid");
		/** @type {number[]} */
		const cells = [];
		const maximumSourceLayer = Math.min(geometry.y + geometry.height, 3);
		for (let sourceLayer = geometry.y; sourceLayer < maximumSourceLayer; sourceLayer += 1) for (let column = geometry.x; column < geometry.x + geometry.width; column += 1) cells.push((2 - sourceLayer) * 4 + column);
		cells.sort((left, right) => left - right);
		return Object.freeze(cells);
	}
	/**
	* Validate exact derived-mask truth without invoking accessors or accepting
	* truncation, duplicates, reordering, or geometry/mask disagreement.
	*
	* @param {unknown} value
	* @param {AeroFlowObstacleGeometry} geometry
	* @returns {value is readonly number[]}
	*/
	function isFlowObstacleGridMask(value, geometry) {
		if (!Array.isArray(value) || Reflect.ownKeys(value).length !== value.length + 1) return false;
		const expected = deriveFlowObstacleGridMask(geometry);
		if (value.length !== expected.length) return false;
		for (let index = 0; index < expected.length; index += 1) {
			const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
			if (!descriptor || !descriptor.enumerable || !("value" in descriptor) || descriptor.value !== expected[index]) return false;
		}
		return true;
	}
	//#endregion
	//#region ../aerobeat-web-content-authoring/src/converter.js
	/** @typedef {"Easy" | "Normal" | "Hard" | "Expert" | "ExpertPlus"} Difficulty */
	/** @typedef {Record<string, unknown>} DataRecord */
	/**
	* Convert one normalized difficulty into Flow plus four Boxing charts.
	*
	* @param {Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>} sourceSummary
	* @param {{difficulty: Difficulty, songToken: string, songName: string, bpm: number, sourceProvider: string, sourceId: string, sourceVersionHash: string, sourceDifficultyPath: string, sourceBeatmapVersion: string, sourceDifficultyHash?: string, audioPath?: string, audioContentHash?: string, modifiers?: readonly string[], presentationSuggestion?: Readonly<Record<string, unknown>>, converterProfile?: Readonly<Record<string, unknown>>}} options
	* @param {(progress: number, phase: string) => void} [onProgress]
	* @returns {Promise<Readonly<{package: DataRecord, packageHash: string, sourceHash: string, charts: DataRecord[], traces: DataRecord[], flowTrace: DataRecord}>>}
	*/
	async function convertDifficulty(sourceSummary, options, onProgress = () => void 0) {
		const bpm = positive(options.bpm, 120);
		const difficulty = normalizeDifficulty(options.difficulty);
		const songToken = sanitizeToken(options.songToken || options.sourceId || "imported");
		const modifiers = normalizeModifiers(options.modifiers ?? []);
		const converterProfile = options.converterProfile ? await normalizeConverterProfile(options.converterProfile) : null;
		const converterSettings = converterProfile ? {
			...converterProfile.settings,
			profileApplied: true
		} : {
			guardRelocationRadius: 0,
			reachAllowanceSubcells: 0,
			profileApplied: false
		};
		const sourceHash = await prefixedSha256(canonicalJson(sourceSummary));
		const sourceDifficultyHash = options.sourceDifficultyHash ?? await prefixedSha256(canonicalJson(sourceSummary));
		const charts = [];
		const traces = [];
		let matrixIndex = 0;
		for (const recipe of recipeDefinitions) {
			const generated = await generateEvents(sourceSummary, difficulty, bpm, recipe, modifiers, converterSettings);
			for (const rulesetId of [semanticTrackRulesetId, spatialGridRulesetId]) {
				const chart = await chartFor(generated, difficulty, songToken, recipe, rulesetId, sourceHash, modifiers, options.presentationSuggestion, converterProfile);
				charts.push(chart);
				traces.push({
					chartId: chart.chartId,
					difficulty,
					bpm,
					recipeId: recipe.recipeId,
					rulesetId,
					sourceHash,
					contentHash: chart.prototype.contentHash,
					sourceDifficultyPath: options.sourceDifficultyPath,
					sourceBeatmapVersion: options.sourceBeatmapVersion,
					sourceDifficultyHash,
					...converterProfile ? { converterProfile: cloneData(converterProfile) } : {},
					optimizer: cloneData(generated.optimizer),
					events: cloneData(generated.trace)
				});
				matrixIndex += 1;
				onProgress(.15 + matrixIndex * .15, "converting");
			}
		}
		const flow = convertFlowChart(sourceSummary, difficulty, songToken);
		Object.assign(flow.trace, {
			sourceHash,
			sourceDifficultyPath: options.sourceDifficultyPath,
			sourceBeatmapVersion: options.sourceBeatmapVersion,
			sourceDifficultyHash
		});
		charts.push(flow.chart);
		const packageId = `ab-songpkg-${songToken}-${sanitizeToken(options.sourceVersionHash).slice(0, 12)}-${difficulty.toLowerCase()}`;
		const songId = `ab-song-${songToken}`;
		const sets = charts.map((chart) => ({
			schemaId: "aerobeat.set.v1",
			schemaVersion: 1,
			recordVersion: 1,
			setId: `ab-set-${String(chart.chartId).replace(/^ab-chart-/u, "")}`,
			setName: `${titleize(songToken)} ${difficulty} ${titleize(String(chart.mode))}`,
			songId,
			chartId: chart.chartId
		}));
		const durationSec = estimateDuration(charts, bpm);
		const packageRecord = {
			schemaId: "aerobeat.song-package.v2",
			schemaVersion: 2,
			packageVersion: "2.0.0",
			packageId,
			songId,
			songName: options.songName || titleize(songToken),
			source: {
				provider: options.sourceProvider,
				sourceId: options.sourceId,
				sourceVersionHash: options.sourceVersionHash,
				difficulty,
				sourceDifficultyPath: options.sourceDifficultyPath,
				sourceBeatmapVersion: options.sourceBeatmapVersion,
				sourceDifficultyHash,
				sourceHash,
				flowObstacleContract: "source_geometry_v1",
				...converterProfile ? { converterProfile: cloneData(converterProfile) } : {}
			},
			song: {
				schemaId: "aerobeat.song.v1",
				schemaVersion: 1,
				recordVersion: 1,
				songId,
				songName: options.songName || titleize(songToken),
				durationSec,
				...options.audioPath && options.audioContentHash ? { audio: {
					filePath: options.audioPath,
					contentHash: options.audioContentHash
				} } : {},
				timing: {
					anchorMs: 0,
					tempoSegments: [{
						startBeat: 0,
						bpm
					}],
					stopSegments: [],
					timeSignatureSegments: [{
						startBeat: 0,
						numerator: 4,
						denominator: 4
					}]
				}
			},
			charts,
			sets,
			recipeDefinitions: cloneData(recipeDefinitions),
			rulesetDefinitions: cloneData(rulesetDefinitions),
			conversionTrace: {
				boxing: traces,
				flow: [flow.trace],
				...converterProfile ? { converterProfile: cloneData(converterProfile) } : {}
			},
			presentationSuggestion: options.presentationSuggestion ? cloneData(options.presentationSuggestion) : null
		};
		const packageHash = await prefixedSha256(canonicalJson(packageRecord));
		onProgress(.8, "validating");
		return deepFreeze({
			package: packageRecord,
			packageHash,
			sourceHash,
			charts,
			traces,
			flowTrace: flow.trace
		});
	}
	/** @param {DataRecord} generated @param {Difficulty} difficulty @param {string} songToken @param {DataRecord} recipe @param {string} rulesetId @param {string} sourceHash @param {readonly string[]} modifiers @param {Readonly<Record<string, unknown>> | undefined} suggestion @param {Readonly<Record<string, unknown>> | null} converterProfile */
	async function chartFor(generated, difficulty, songToken, recipe, rulesetId, sourceHash, modifiers, suggestion, converterProfile) {
		const recipeId = String(recipe.recipeId);
		const recipeShort = recipeId === "row_family_balanced_height_v1" ? "row-family" : "cut-family";
		const rulesetShort = rulesetId === "boxing_semantic_track_v1" ? "semantic-track" : "spatial-grid";
		const beats = cloneData(generated.beats);
		const recipeHash = await prefixedSha256(canonicalJson(recipe));
		const rulesetHash = await prefixedSha256(canonicalJson(rulesetDefinitions.find((candidate) => candidate.rulesetId === rulesetId) ?? rulesetDefinitions[0]));
		const contentHash = await prefixedSha256(canonicalJson({
			beats,
			recipeId,
			rulesetId,
			sourceHash,
			...converterProfile ? { converterProfile } : {}
		}));
		const allModifiers = [...modifiers];
		for (const beat of beats) if (typeof beat.modifier === "string" && !allModifiers.includes(beat.modifier)) allModifiers.push(beat.modifier);
		allModifiers.sort();
		const chart = {
			schemaId: "aerobeat.chart.boxing.v1",
			schemaVersion: 1,
			recordVersion: 1,
			chartId: `ab-chart-${songToken}-boxing-${difficulty.toLowerCase()}-${rulesetShort}-${recipeShort}`,
			chartName: `${titleize(songToken)} ${difficulty} Boxing - ${titleize(rulesetShort)} / ${titleize(recipeShort)}`,
			mode: "boxing",
			difficulty,
			prototype: {
				contractId: boxingPrototypeContractId,
				recipeId,
				recipeVersion,
				rulesetId,
				rulesetVersion,
				sourceHash,
				recipeHash,
				rulesetHash,
				contentHash,
				modifiers: allModifiers,
				...converterProfile ? { converterProfile: cloneData(converterProfile) } : {},
				regenerationRequiredFor: [
					"punchMinSpacingMs",
					"reachSubcellsPerBeat",
					"familyBalance",
					"guardRelocation"
				]
			},
			beats
		};
		if (suggestion) Object.assign(chart, { presentationSuggestion: cloneData(suggestion) });
		return chart;
	}
	/** @param {Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>} sourceSummary @param {Difficulty} difficulty @param {number} bpm @param {DataRecord} recipe @param {readonly string[]} modifiers @param {{guardRelocationRadius:number,reachAllowanceSubcells:number,profileApplied:boolean}} converterSettings */
	async function generateEvents(sourceSummary, difficulty, bpm, recipe, modifiers, converterSettings) {
		const trace = [];
		const obstacleWindows = obstaclesFor(sourceSummary.obstacles ?? [], bpm);
		const groups = noteGroups(sourceSummary.colorNotes ?? []);
		const candidates = [];
		const rowCounts = [
			0,
			0,
			0
		];
		for (const [start, rawGroup] of groups) {
			const group = collapseSameHand(rawGroup);
			const sourceEventIds = sourceIds(rawGroup, "note");
			const retainedIds = sourceIds(group, "note");
			for (const sourceId of sourceEventIds) if (!retainedIds.includes(sourceId)) trace.push({
				sourceEventIds: [sourceId],
				start,
				action: "drop",
				reason: "same_hand_simultaneous_stable_tiebreak"
			});
			if (hasBothHands(group)) {
				candidates.push({
					kind: "guard",
					start,
					notes: group,
					sourceEventIds,
					stableId: sourceEventIds.join("+")
				});
				continue;
			}
			if (!group.length) continue;
			const note = group[0];
			const family = familyFor(note, String(recipe.recipeId));
			const targetRow = targetRowFor(note, family, String(recipe.recipeId), rowCounts);
			rowCounts[targetRow] += 1;
			candidates.push({
				kind: "punch",
				start,
				note,
				family,
				targetRow,
				sourceEventIds,
				stableId: sourceEventIds.join("+")
			});
		}
		candidates.sort(candidateOrder);
		const optimizer = selectSpacingOptimizedPunches(candidates, bpm, obstacleWindows, difficulty, converterSettings);
		const beats = [];
		let lastPunchMs = -1e9;
		let previousHand = "";
		const wristSubcell = {
			left: seedSubcell(5),
			right: seedSubcell(6)
		};
		const wristBeat = {
			left: 0,
			right: 0
		};
		const familyCounts = {
			straight: 0,
			hook: 0,
			uppercut: 0
		};
		for (const candidate of candidates) {
			const start = Number(candidate.start);
			const startMs = beatToMs(start, bpm);
			if (candidate.kind === "guard") {
				const emitted = await emitGuard(candidate, obstacleWindows, wristSubcell, wristBeat, difficulty, bpm, String(recipe.recipeId), converterSettings);
				trace.push(emitted.trace);
				if (emitted.ok && emitted.beat) {
					beats.push(emitted.beat);
					const target = emitted.beat.guardTarget;
					wristSubcell.left = seedSubcell(Number(target.leftCell));
					wristSubcell.right = seedSubcell(Number(target.rightCell));
					wristBeat.left = start;
					wristBeat.right = start;
				}
				continue;
			}
			if (!optimizer.selected.has(String(candidate.stableId))) {
				trace.push(dropTrace(candidate, optimizer.infeasible.get(String(candidate.stableId)) ?? "spacing_optimizer_rejected", { priorityOrder: optimizerPriority }));
				continue;
			}
			const note = candidate.note;
			const hand = String(note.hand);
			const family = String(candidate.family);
			const spatial = spatialTarget(family, hand, Number(candidate.targetRow));
			const blocked = blockedSubcellsAt(startMs, obstacleWindows);
			const safe = spatial.acceptedSubcells.filter((subcell) => !blocked.has(subcell));
			if (!safe.length) {
				trace.push(dropTrace(candidate, "spatial_target_blocked"));
				continue;
			}
			spatial.acceptedSubcells = safe;
			const deltaBeats = Math.max(start - wristBeat[hand], 0);
			const target = safe.find((subcell) => reachable(wristSubcell[hand], subcell, deltaBeats, reachSubcellsPerBeat[difficulty] + converterSettings.reachAllowanceSubcells, blocked));
			if (target === void 0) {
				trace.push(dropTrace(candidate, "unreachable_after_optimizer"));
				continue;
			}
			if (startMs - lastPunchMs < 360) {
				trace.push(dropTrace(candidate, "punch_min_spacing", {
					previousHand,
					spacingMs: startMs - lastPunchMs
				}));
				continue;
			}
			const type = `${family}_${hand}`;
			const generatedEventId = await eventId(String(recipe.recipeId), String(candidate.stableId), type);
			const beat = {
				start,
				type,
				eventId: generatedEventId,
				sourceEventIds: cloneData(candidate.sourceEventIds),
				spatialTarget: spatial,
				timingWindowMs: 180,
				evidenceFreshnessMs: 150
			};
			if (modifiers.includes("any_punch")) Object.assign(beat, { modifier: "any_punch" });
			else if (modifiers.includes("cross_body")) Object.assign(beat, { modifier: "cross_body" });
			beats.push(beat);
			lastPunchMs = startMs;
			previousHand = hand;
			familyCounts[family] += 1;
			wristSubcell[hand] = target;
			wristBeat[hand] = start;
			trace.push({
				sourceEventIds: beat.sourceEventIds,
				eventId: generatedEventId,
				start,
				action: "emit",
				kind: "punch",
				family,
				hand,
				sourceDirection: Number(note.direction ?? 8),
				generatedDirection: spatial.entryDirection ?? "semantic_straight",
				target: cloneData(spatial)
			});
		}
		for (const window of obstacleWindows) {
			const blockedCells = [...window.blockedCells];
			const type = obstacleType(blockedCells);
			const sourceId = `obstacle-${String(window.sourceIndex).padStart(3, "0")}`;
			if (type === "squat" && modifiers.includes("no_squats") || type.startsWith("weave_") && modifiers.includes("no_weaves")) {
				trace.push({
					sourceEventIds: [sourceId],
					start: window.startBeat,
					action: "drop",
					reason: "disabled_by_modifier",
					type
				});
				continue;
			}
			const safeCells = Array.from({ length: 12 }, (_, index) => index).filter((cell) => !blockedCells.includes(cell));
			const emitted = {
				start: window.startBeat,
				type,
				eventId: await eventId(String(recipe.recipeId), sourceId, type),
				sourceEventIds: [sourceId],
				checkpoint: {
					kind: "instantaneous",
					freshnessMs: 150,
					timingWindowMs: 180,
					noseSafeCells: safeCells
				},
				blockedCells
			};
			beats.push(emitted);
			trace.push({
				sourceEventIds: [sourceId],
				start: window.startBeat,
				action: "emit",
				kind: "obstacle_checkpoint",
				type,
				blockedCells,
				noseSafeCells: safeCells
			});
		}
		beats.sort((left, right) => Number(left.start) - Number(right.start) || String(left.eventId).localeCompare(String(right.eventId)));
		return {
			beats,
			trace,
			familyCounts,
			optimizer: {
				priorityOrder: optimizerPriority,
				punchMinSpacingMs: 360,
				...converterSettings.profileApplied ? {
					guardRelocationRadius: converterSettings.guardRelocationRadius,
					reachAllowanceSubcells: converterSettings.reachAllowanceSubcells
				} : {},
				selectedStableIds: [...optimizer.selected.keys()]
			}
		};
	}
	const optimizerPriority = [
		"retained_punches",
		"hand_alternation",
		"family_balance",
		"source_order",
		"stable_event_id"
	];
	/** @param {DataRecord[]} candidates @param {number} bpm @param {ObstacleWindow[]} obstacles @param {Difficulty} difficulty @param {{guardRelocationRadius:number,reachAllowanceSubcells:number,profileApplied:boolean}} converterSettings */
	function selectSpacingOptimizedPunches(candidates, bpm, obstacles, difficulty, converterSettings) {
		const punches = [];
		const infeasible = /* @__PURE__ */ new Map();
		const guardTimesMs = candidates.filter((candidate) => candidate.kind === "guard").map((candidate) => beatToMs(Number(candidate.start), bpm));
		for (const candidate of candidates) {
			if (candidate.kind !== "punch") continue;
			const punchMs = beatToMs(Number(candidate.start), bpm);
			const reason = guardTimesMs.some((guardMs) => Math.abs(punchMs - guardMs) <= 180.0001) ? "guard_window_reserved_before_optimizer" : staticInfeasibility(candidate, bpm, obstacles, difficulty, converterSettings);
			if (reason) infeasible.set(String(candidate.stableId), reason);
			else punches.push(candidate);
		}
		punches.sort(candidateOrder);
		const best = [[]];
		for (let index = 0; index < punches.length; index += 1) {
			const candidate = punches[index];
			let compatible = -1;
			const candidateMs = beatToMs(Number(candidate.start), bpm);
			for (let prior = index - 1; prior >= 0; prior -= 1) if (candidateMs - beatToMs(Number(punches[prior].start), bpm) >= 360) {
				compatible = prior;
				break;
			}
			const take = [...best[compatible + 1], candidate];
			const skip = [...best[index]];
			best.push(sequenceBetter(take, skip) ? take : skip);
		}
		return {
			selected: new Map(best.at(-1).map((candidate) => [String(candidate.stableId), true])),
			infeasible
		};
	}
	/** @param {DataRecord} candidate @param {number} bpm @param {ObstacleWindow[]} obstacles @param {Difficulty} difficulty @param {{guardRelocationRadius:number,reachAllowanceSubcells:number,profileApplied:boolean}} converterSettings */
	function staticInfeasibility(candidate, bpm, obstacles, difficulty, converterSettings) {
		const note = candidate.note;
		const hand = String(note.hand);
		const spatial = spatialTarget(String(candidate.family), hand, Number(candidate.targetRow));
		const blocked = blockedSubcellsAt(beatToMs(Number(candidate.start), bpm), obstacles);
		let safe = false;
		let reach = false;
		const seed = hand === "left" ? 5 : 6;
		for (const subcell of spatial.acceptedSubcells) {
			if (blocked.has(subcell)) continue;
			safe = true;
			if (reachable(seedSubcell(seed), subcell, Number(candidate.start), reachSubcellsPerBeat[difficulty] + converterSettings.reachAllowanceSubcells, blocked)) {
				reach = true;
				break;
			}
		}
		return !safe ? "spatial_target_blocked_before_optimizer" : !reach ? "unreachable_before_optimizer" : "";
	}
	/** @param {DataRecord[]} left @param {DataRecord[]} right */
	function sequenceBetter(left, right) {
		if (left.length !== right.length) return left.length > right.length;
		const alternations = (sequence) => sequence.slice(1).reduce((count, candidate, index) => count + (String(
			/** @type {DataRecord} */
			candidate.note.hand
		) !== String(
			/** @type {DataRecord} */
			sequence[index].note.hand
		) ? 1 : 0), 0);
		const imbalance = (sequence) => {
			const counts = {
				straight: 0,
				hook: 0,
				uppercut: 0
			};
			for (const candidate of sequence) counts[String(candidate.family)] += 1;
			return Math.max(...Object.values(counts)) - Math.min(...Object.values(counts));
		};
		if (alternations(left) !== alternations(right)) return alternations(left) > alternations(right);
		if (imbalance(left) !== imbalance(right)) return imbalance(left) < imbalance(right);
		for (let index = 0; index < left.length; index += 1) {
			if (Number(left[index].start) !== Number(right[index].start)) return Number(left[index].start) < Number(right[index].start);
			if (String(left[index].stableId) !== String(right[index].stableId)) return String(left[index].stableId) < String(right[index].stableId);
		}
		return false;
	}
	/** @typedef {{startBeat:number,endBeat:number,startMs:number,endMs:number,blockedCells:number[],sourceIndex:number}} ObstacleWindow */
	/** @param {readonly Readonly<Record<string, unknown>>[]} obstacles @param {number} bpm @returns {ObstacleWindow[]} */
	function obstaclesFor(obstacles, bpm) {
		if (obstacles.length > 128) throw new Error("flow_obstacle_limit_exceeded");
		return obstacles.map((entry, index) => {
			const start = Number(entry.start);
			const duration = Number(entry.duration);
			const endBeat = start + duration;
			const resolvedEndMs = beatToMs(endBeat, bpm);
			if (!Number.isFinite(start) || start < 0 || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(endBeat) || resolvedEndMs > 864e5) throw new Error("flow_obstacle_interval_invalid");
			return {
				startBeat: start,
				endBeat,
				startMs: beatToMs(start, bpm) - 180,
				endMs: resolvedEndMs + 180,
				blockedCells: [...gridMaskForObstacle(entry)],
				sourceIndex: Number(entry.sourceIndex ?? index)
			};
		});
	}
	/** @param {Readonly<Record<string, unknown>>} obstacle */
	function geometryForObstacle(obstacle) {
		const geometry = {
			schema: "aerobeat/flow_obstacle_geometry",
			version: 1,
			coordinateSpace: "beatsaber_lane_layer",
			x: Number(obstacle.x),
			y: Number(obstacle.y),
			width: Number(obstacle.width),
			height: Number(obstacle.height)
		};
		if (!isFlowObstacleGeometry(geometry)) throw new Error("flow_obstacle_geometry_invalid");
		return geometry;
	}
	/** @param {Readonly<Record<string, unknown>>} obstacle */
	function gridMaskForObstacle(obstacle) {
		return deriveFlowObstacleGridMask(geometryForObstacle(obstacle));
	}
	/** @param {number} timeMs @param {ObstacleWindow[]} windows */
	function blockedSubcellsAt(timeMs, windows) {
		const blocked = /* @__PURE__ */ new Set();
		for (const window of windows) if (timeMs >= window.startMs && timeMs <= window.endMs) for (const cell of window.blockedCells) for (const subcell of acceptedSubcells(cell, "cell", "left")) blocked.add(subcell);
		return blocked;
	}
	/** @param {number[]} cells */
	function obstacleType(cells) {
		let left = 0;
		let right = 0;
		for (const cell of cells) cell % 4 <= 1 ? left += 1 : right += 1;
		return left > right ? "weave_right" : right > left ? "weave_left" : "squat";
	}
	/** @param {DataRecord} candidate @param {ObstacleWindow[]} obstacles @param {{left:number,right:number}} wristSubcell @param {{left:number,right:number}} wristBeat @param {Difficulty} difficulty @param {number} bpm @param {string} recipeIdValue @param {{guardRelocationRadius:number,reachAllowanceSubcells:number,profileApplied:boolean}} converterSettings */
	async function emitGuard(candidate, obstacles, wristSubcell, wristBeat, difficulty, bpm, recipeIdValue, converterSettings) {
		const notes = candidate.notes;
		const left = noteForHand(notes, "left");
		const right = noteForHand(notes, "right");
		const crossed = Number(left.cell) % 4 > Number(right.cell) % 4;
		const sourcePair = [topLeftCell(Number(left.cell)), topLeftCell(Number(right.cell))];
		const start = Number(candidate.start);
		const pair = chooseGuardPair(sourcePair, crossed, blockedSubcellsAt(beatToMs(start, bpm), obstacles), start, wristSubcell, wristBeat, difficulty, converterSettings);
		if (!pair.length) return {
			ok: false,
			trace: dropTrace(candidate, "guard_no_legal_pair")
		};
		const leftCell = crossed ? pair[1] : pair[0];
		const rightCell = crossed ? pair[0] : pair[1];
		const sourceEventIds = cloneData(candidate.sourceEventIds);
		const id = await eventId(recipeIdValue, String(candidate.stableId), "guard");
		const beat = {
			start,
			type: "guard",
			eventId: id,
			sourceEventIds,
			guardTarget: {
				leftCell,
				rightCell,
				crossed,
				sourcePair
			},
			checkpoint: {
				kind: "instantaneous",
				freshnessMs: 150,
				timingWindowMs: 180
			},
			timingWindowMs: 180,
			evidenceFreshnessMs: 150
		};
		if (crossed) Object.assign(beat, { modifier: "crossed_guard" });
		return {
			ok: true,
			beat,
			trace: {
				sourceEventIds,
				eventId: id,
				start,
				action: "emit",
				kind: "guard",
				sourcePair,
				generatedPair: pair,
				crossed
			}
		};
	}
	/** @param {number[]} sourcePair @param {boolean} crossed @param {Set<number>} blocked @param {number} start @param {{left:number,right:number}} wristSubcell @param {{left:number,right:number}} wristBeat @param {Difficulty} difficulty @param {{guardRelocationRadius:number,reachAllowanceSubcells:number,profileApplied:boolean}} converterSettings */
	function chooseGuardPair(sourcePair, crossed, blocked, start, wristSubcell, wristBeat, difficulty, converterSettings) {
		const sourceSorted = [...sourcePair].sort((a, b) => a - b);
		const candidates = [];
		for (const pair of guardPairs) {
			const generatedLeftCell = crossed ? pair[1] : pair[0], generatedRightCell = crossed ? pair[0] : pair[1];
			if (converterSettings.profileApplied && Math.max(subcellManhattan(seedSubcell(sourcePair[0]), seedSubcell(generatedLeftCell)), subcellManhattan(seedSubcell(sourcePair[1]), seedSubcell(generatedRightCell))) > converterSettings.guardRelocationRadius) continue;
			const subcells = [seedSubcell(pair[0]), seedSubcell(pair[1])];
			if (blocked.has(subcells[0]) || blocked.has(subcells[1])) continue;
			const leftTarget = crossed ? subcells[1] : subcells[0];
			const rightTarget = crossed ? subcells[0] : subcells[1];
			const rate = reachSubcellsPerBeat[difficulty] + converterSettings.reachAllowanceSubcells;
			if (!reachable(wristSubcell.left, leftTarget, Math.max(start - wristBeat.left, 0), rate, blocked) || !reachable(wristSubcell.right, rightTarget, Math.max(start - wristBeat.right, 0), rate, blocked)) continue;
			const sourceRow = Math.floor(sourceSorted[0] / 4) === Math.floor(sourceSorted[1] / 4) ? Math.floor(sourceSorted[0] / 4) : 1;
			const pairRow = Math.floor(pair[0] / 4);
			const sourceMid = (sourceSorted[0] + sourceSorted[1]) / 2;
			const pairMid = (pair[0] + pair[1]) / 2;
			candidates.push({
				pair: [...pair],
				row: Math.abs(pairRow - sourceRow),
				mid: Math.abs(pairMid - sourceMid),
				center: Math.abs(pairMid - 5.5),
				id: pair[0]
			});
		}
		candidates.sort((a, b) => a.row - b.row || a.mid - b.mid || a.center - b.center || a.id - b.id);
		return candidates[0]?.pair ?? [];
	}
	/** @param {string} family @param {string} hand @param {number} row */
	function spatialTarget(family, hand, row) {
		let column = hand === "left" ? 1 : 2;
		let targetRow = clamp(row, 0, 2);
		let direction = "";
		let sourceCell = -1;
		if (family === "hook") {
			column = hand === "left" ? 2 : 1;
			direction = hand === "left" ? "right" : "left";
			sourceCell = targetRow * 4 + (hand === "left" ? 1 : 2);
		} else if (family === "uppercut") {
			targetRow = Math.min(targetRow, 1);
			direction = "up";
			sourceCell = (targetRow + 1) * 4 + column;
		}
		const targetCell = targetRow * 4 + column;
		const result = {
			targetCell,
			acceptedSubcells: acceptedSubcells(targetCell, family, hand),
			sourceCell
		};
		if (direction) Object.assign(result, { entryDirection: direction });
		if (family === "straight") Object.assign(result, {
			qualificationMs: 100,
			semanticQualification: "straight"
		});
		return result;
	}
	/** @param {number} cell @param {string} family @param {string} hand */
	function acceptedSubcells(cell, family, hand) {
		const row = Math.floor(cell / 4), column = cell % 4, result = [];
		for (const subRow of [row * 2, row * 2 + 1]) {
			result.push(subRow * 8 + column * 2, subRow * 8 + column * 2 + 1);
			if (family === "straight") {
				const margin = hand === "left" ? column * 2 + 2 : column * 2 - 1;
				if (margin >= 0 && margin < 8) result.push(subRow * 8 + margin);
			}
		}
		return result.sort((a, b) => a - b);
	}
	/** @param {number} start @param {number} target @param {number} deltaBeats @param {number} rate @param {Set<number>} blocked */
	function reachable(start, target, deltaBeats, rate, blocked) {
		if (target < 0 || target >= 48 || blocked.has(target)) return false;
		const distances = Array(48).fill(Infinity), visited = /* @__PURE__ */ new Set();
		distances[clamp(start, 0, 47)] = 0;
		for (let step = 0; step < 48; step += 1) {
			let current = -1, currentDistance = Infinity;
			for (let candidate = 0; candidate < 48; candidate += 1) if (!visited.has(candidate) && distances[candidate] < currentDistance) {
				current = candidate;
				currentDistance = distances[candidate];
			}
			if (current < 0 || current === target) break;
			visited.add(current);
			const x = current % 8, y = Math.floor(current / 8);
			for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
				if (!dx && !dy) continue;
				const nx = x + dx, ny = y + dy;
				if (nx < 0 || nx >= 8 || ny < 0 || ny >= 6) continue;
				const next = ny * 8 + nx;
				if (blocked.has(next)) continue;
				distances[next] = Math.min(distances[next], currentDistance + (dx && dy ? Math.SQRT2 : 1));
			}
		}
		return distances[target] <= Math.max(deltaBeats * rate, 0) + 1e-4;
	}
	/** @param {Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>} summary @param {Difficulty} difficulty @param {string} songToken */
	function convertFlowChart(summary, difficulty, songToken) {
		const beats = [];
		const events = [];
		const lookup = buildFlowNoteLookup(summary.colorNotes ?? []);
		for (const note of summary.colorNotes ?? []) {
			const emitted = emitFlowNote(note);
			beats.push(emitted);
			events.push({
				start: Number(note.start ?? 0),
				sourceFamily: "note",
				result: {
					action: "emit",
					beat: cloneData(emitted),
					noteRef: flowNoteRef(note)
				},
				note: cloneData(note)
			});
		}
		for (const bomb of summary.bombNotes ?? []) {
			const emitted = {
				start: Number(bomb.start ?? 0),
				type: "bomb",
				placement: topLeftCell(Number(bomb.cell ?? 0))
			};
			beats.push(emitted);
			events.push({
				start: emitted.start,
				sourceFamily: "bomb",
				result: {
					action: "emit",
					beat: cloneData(emitted)
				},
				bomb: cloneData(bomb)
			});
		}
		for (const obstacle of summary.obstacles ?? []) {
			const emitted = {
				start: Number(obstacle.start ?? 0),
				end: Number(obstacle.start ?? 0) + Number(obstacle.duration ?? 0),
				type: "obstacle",
				geometry: geometryForObstacle(obstacle),
				gridMask: gridMaskForObstacle(obstacle)
			};
			beats.push(emitted);
			events.push({
				start: emitted.start,
				sourceFamily: "obstacle",
				result: {
					action: "emit",
					beat: cloneData(emitted)
				},
				obstacle: cloneData(obstacle)
			});
		}
		for (const slider of summary.sliders ?? []) {
			const emitted = emitFlowArc(slider, lookup);
			beats.push(emitted);
			events.push({
				start: Number(slider.start ?? 0),
				sourceFamily: "slider",
				result: {
					action: "emit",
					beat: cloneData(emitted)
				},
				slider: cloneData(slider)
			});
		}
		for (const burst of summary.burstSliders ?? []) {
			const emitted = {
				start: Number(burst.start ?? 0),
				end: Number(burst.end ?? burst.start ?? 0),
				type: "burst",
				hand: String(burst.hand ?? "left"),
				placement: topLeftCell(Number(burst.cell ?? 0)),
				direction: Number(burst.direction ?? 8),
				tailPlacement: topLeftCell(Number(burst.tailCell ?? burst.cell ?? 0)),
				checkpointCount: Math.max(Number(burst.sliceCount ?? 1), 1)
			};
			if (Object.hasOwn(burst, "spacingBias")) Object.assign(emitted, { spacingBias: Number(burst.spacingBias) });
			beats.push(emitted);
			events.push({
				start: emitted.start,
				sourceFamily: "burstSlider",
				result: {
					action: "emit",
					beat: cloneData(emitted)
				},
				source: cloneData(burst)
			});
		}
		const order = {
			note: 0,
			bomb: 1,
			obstacle: 2,
			arc: 3,
			burst: 4
		};
		beats.sort((a, b) => Number(a.start) - Number(b.start) || (order[a.type] ?? 99) - (order[b.type] ?? 99) || JSON.stringify(a).localeCompare(JSON.stringify(b)));
		return {
			chart: {
				schemaId: "aerobeat.chart.flow.v2",
				schemaVersion: 2,
				recordVersion: 1,
				rulesetId: "flow_grid_v2",
				chartId: `ab-chart-${songToken}-flow-${difficulty.toLowerCase()}`,
				chartName: `${titleize(songToken)} ${difficulty} Flow`,
				mode: "flow",
				difficulty,
				beats
			},
			trace: {
				difficulty,
				flowObstacleContract: "source_geometry_v1",
				events
			}
		};
	}
	/** @param {Readonly<Record<string, unknown>>} note */
	function emitFlowNote(note) {
		const direction = Number(note.direction ?? 8);
		const beat = {
			start: Number(note.start ?? 0),
			type: "note",
			hand: String(note.hand ?? "left"),
			placement: topLeftCell(Number(note.cell ?? 0)),
			requiresDirection: direction !== 8,
			angleOffset: Number(note.angleOffset ?? 0)
		};
		if (direction !== 8) Object.assign(beat, { direction });
		return beat;
	}
	/** @param {Readonly<Record<string, unknown>>} slider @param {Map<string,string>} lookup */
	function emitFlowArc(slider, lookup) {
		const sourceStartPlacement = Number(slider.cell ?? 0), sourceEndPlacement = Number(slider.tailCell ?? slider.cell ?? 0);
		const arc = {
			start: Number(slider.start ?? 0),
			end: Number(slider.end ?? slider.start ?? 0),
			type: "arc",
			hand: String(slider.hand ?? "left"),
			startPlacement: topLeftCell(sourceStartPlacement),
			endPlacement: topLeftCell(sourceEndPlacement),
			startDirection: Number(slider.direction ?? 8),
			endDirection: Number(slider.tailDirection ?? slider.direction ?? 8),
			headCurveMultiplier: Number(slider.headCurveMultiplier ?? 1),
			tailCurveMultiplier: Number(slider.tailCurveMultiplier ?? 1),
			midAnchorMode: Number(slider.midAnchorMode ?? 0)
		};
		const start = lookup.get(flowNoteKey(arc.start, arc.hand, sourceStartPlacement));
		const end = lookup.get(flowNoteKey(arc.end, arc.hand, sourceEndPlacement));
		if (start) Object.assign(arc, { startNoteRef: start });
		if (end) Object.assign(arc, { endNoteRef: end });
		return arc;
	}
	/** @param {readonly Readonly<Record<string, unknown>>[]} notes */
	function buildFlowNoteLookup(notes) {
		const result = /* @__PURE__ */ new Map();
		for (const note of notes) {
			const key = flowNoteKey(Number(note.start ?? 0), String(note.hand ?? "left"), Number(note.cell ?? 0));
			if (!result.has(key)) result.set(key, flowNoteRef(note));
		}
		return result;
	}
	/** @param {number} start @param {string} hand @param {number} cell */
	function flowNoteKey(start, hand, cell) {
		return `${hand}|${start.toFixed(3)}|${cell}`;
	}
	/** @param {Readonly<Record<string, unknown>>} note */
	function flowNoteRef(note) {
		return `flow-note-${String(Number(note.sourceIndex ?? 0)).padStart(3, "0")}-${String(note.hand ?? "left")}-${Number(note.cell ?? 0)}-${Number(note.start ?? 0).toFixed(3)}`;
	}
	/** @param {readonly Readonly<Record<string, unknown>>[]} notes @returns {[number, DataRecord[]][]} */
	function noteGroups(notes) {
		/** @type {Map<number, DataRecord[]>} */ const result = /* @__PURE__ */ new Map();
		for (const value of notes) {
			const start = Math.round(Number(value.start ?? 0) * 1e3) / 1e3;
			if (!result.has(start)) result.set(start, []);
			result.get(start).push(cloneData(value));
		}
		return [...result.entries()].sort((a, b) => a[0] - b[0]);
	}
	/** @param {DataRecord[]} notes @returns {DataRecord[]} */
	function collapseSameHand(notes) {
		/** @type {DataRecord[]} */ const result = [];
		for (const hand of ["left", "right"]) {
			const entries = notes.filter((note) => String(note.hand) === hand).sort((a, b) => Number(a.cell) - Number(b.cell) || Number(a.sourceIndex) - Number(b.sourceIndex));
			if (entries[0]) result.push(cloneData(entries[0]));
		}
		return result;
	}
	/** @param {DataRecord[]} notes @param {string} prefix */
	function sourceIds(notes, prefix) {
		return notes.map((note) => `${prefix}-${String(Number(note.sourceIndex ?? 0)).padStart(3, "0")}`).sort();
	}
	/** @param {DataRecord[]} notes */
	function hasBothHands(notes) {
		return notes.some((note) => note.hand === "left") && notes.some((note) => note.hand === "right");
	}
	/** @param {DataRecord[]} notes @param {string} hand */
	function noteForHand(notes, hand) {
		return notes.find((note) => note.hand === hand) ?? {};
	}
	/** @param {DataRecord} note @param {string} recipeIdValue */
	function familyFor(note, recipeIdValue) {
		if (recipeIdValue === "row_family_balanced_height_v1") {
			const row = topLeftRow(Number(note.cell));
			return row === 0 ? "uppercut" : row === 1 ? "straight" : "hook";
		}
		const direction = Number(note.direction ?? 8);
		return direction === 0 ? "uppercut" : direction === 2 || direction === 3 ? "hook" : "straight";
	}
	/** @param {DataRecord} note @param {string} family @param {string} recipeIdValue @param {number[]} counts */
	function targetRowFor(note, family, recipeIdValue, counts) {
		const source = topLeftRow(Number(note.cell));
		if (recipeIdValue === "cut_family_source_height_v1") return family === "uppercut" && source === 2 ? 1 : source;
		return (family === "uppercut" ? [0, 1] : [
			0,
			1,
			2
		]).sort((a, b) => counts[a] - counts[b] || a - b)[0];
	}
	/** @param {DataRecord} left @param {DataRecord} right */
	function candidateOrder(left, right) {
		return Number(left.start) - Number(right.start) || String(left.stableId).localeCompare(String(right.stableId));
	}
	/** @param {DataRecord} candidate @param {string} reason @param {DataRecord} [extra] */
	function dropTrace(candidate, reason, extra = {}) {
		return {
			sourceEventIds: cloneData(candidate.sourceEventIds),
			start: Number(candidate.start),
			action: "drop",
			reason,
			...extra
		};
	}
	/** @param {string} recipeIdValue @param {string} sourceId @param {string} kind */
	async function eventId(recipeIdValue, sourceId, kind) {
		const digest = await prefixedSha256(`${recipeIdValue}|${sourceId}|${kind}`);
		return `boxing-${kind.replaceAll("_", "-")}-${digest.slice(7, 19)}`;
	}
	/** @param {number} cell */
	function topLeftRow(cell) {
		return 2 - clamp(Math.floor(cell / 4), 0, 2);
	}
	/** @param {number} cell */
	function topLeftCell(cell) {
		return topLeftRow(cell) * 4 + clamp(cell % 4, 0, 3);
	}
	/** @param {number} cell */
	function seedSubcell(cell) {
		const row = clamp(Math.floor(cell / 4), 0, 2), column = clamp(cell % 4, 0, 3);
		return (row * 2 + 1) * 8 + column * 2 + 1;
	}
	/** @param {number} left @param {number} right */
	function subcellManhattan(left, right) {
		return Math.abs(Math.floor(left / 8) - Math.floor(right / 8)) + Math.abs(left % 8 - right % 8);
	}
	/** @param {number} beat @param {number} bpm */
	function beatToMs(beat, bpm) {
		return beat * 6e4 / Math.max(bpm, 1);
	}
	/** @param {number} value @param {number} minimum @param {number} maximum */
	function clamp(value, minimum, maximum) {
		return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
	}
	/** @param {number} value @param {number} fallback */
	function positive(value, fallback) {
		return Number.isFinite(value) && value > 0 ? value : fallback;
	}
	/** @param {unknown} value @returns {Difficulty} */
	function normalizeDifficulty(value) {
		const result = {
			easy: "Easy",
			normal: "Normal",
			hard: "Hard",
			expert: "Expert",
			expertplus: "ExpertPlus"
		}[String(value).toLowerCase().replace(/[^a-z]/gu, "")];
		if (!result) throw new Error("Unsupported difficulty");
		return result;
	}
	/** @param {readonly string[]} values */
	function normalizeModifiers(values) {
		const result = [...new Set(values.filter((value) => supportedModifiers.includes(value)))];
		result.sort();
		return result;
	}
	/** @param {string} value */
	function sanitizeToken(value) {
		return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "") || "imported";
	}
	/** @param {string} value */
	function titleize(value) {
		return value.replaceAll("_", "-").split("-").filter(Boolean).map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
	}
	/** @param {DataRecord[]} charts @param {number} bpm */
	function estimateDuration(charts, bpm) {
		let maxBeat = 0;
		for (const chart of charts) for (const beat of chart.beats ?? []) maxBeat = Math.max(maxBeat, Number(beat.end ?? beat.start ?? 0));
		return Math.ceil(maxBeat * 60 / Math.max(bpm, 1));
	}
	//#endregion
	//#region ../aerobeat-web-content-authoring/src/parity.js
	/**
	* Cross-language semantic projection. Language-specific canonical hashes are excluded;
	* definitions, timing, lineage, ordering, targets, checkpoints, modifiers and traces are not.
	*
	* @param {unknown} packageValue
	*/
	function semanticParityProjection(packageValue) {
		if (!isPlainRecord(packageValue)) throw new TypeError("Package is required for semantic parity");
		canonicalJson(packageValue);
		if (!Array.isArray(packageValue.charts)) throw new TypeError("Package charts are required for semantic parity");
		return {
			packageSchema: packageValue.schemaId,
			packageSchemaVersion: packageValue.schemaVersion,
			packageVersion: packageValue.packageVersion,
			packageId: packageValue.packageId,
			songId: packageValue.songId,
			source: isPlainRecord(packageValue.source) ? pick(packageValue.source, [
				"provider",
				"sourceId",
				"sourceVersionHash",
				"difficulty",
				"sourceDifficultyPath",
				"sourceBeatmapVersion",
				"sourceDifficultyHash",
				"flowObstacleContract",
				"converterProfile"
			]) : null,
			song: isPlainRecord(packageValue.song) ? pick(packageValue.song, [
				"schemaId",
				"schemaVersion",
				"recordVersion",
				"songId",
				"songName",
				"durationSec",
				"audio",
				"timing"
			]) : null,
			sets: Array.isArray(packageValue.sets) ? packageValue.sets.map((set) => isPlainRecord(set) ? pick(set, [
				"schemaId",
				"schemaVersion",
				"recordVersion",
				"setId",
				"setName",
				"songId",
				"chartId"
			]) : null) : [],
			recipeDefinitions: Array.isArray(packageValue.recipeDefinitions) ? packageValue.recipeDefinitions.map(projectDefinition) : [],
			rulesetDefinitions: Array.isArray(packageValue.rulesetDefinitions) ? packageValue.rulesetDefinitions.map(projectDefinition) : [],
			presentationSuggestion: Object.hasOwn(packageValue, "presentationSuggestion") ? packageValue.presentationSuggestion : null,
			charts: packageValue.charts.map((chart) => {
				if (!isPlainRecord(chart)) return null;
				const prototype = isPlainRecord(chart.prototype) ? chart.prototype : null;
				return {
					schemaId: chart.schemaId,
					schemaVersion: chart.schemaVersion,
					recordVersion: chart.recordVersion,
					chartId: chart.chartId,
					chartName: chart.chartName,
					mode: chart.mode,
					difficulty: chart.difficulty,
					...Object.hasOwn(chart, "rulesetId") ? { rulesetId: chart.rulesetId } : {},
					prototype: prototype ? pick(prototype, [
						"contractId",
						"recipeId",
						"recipeVersion",
						"rulesetId",
						"rulesetVersion",
						"modifiers",
						"converterProfile",
						"regenerationRequiredFor"
					]) : null,
					presentationSuggestion: Object.hasOwn(chart, "presentationSuggestion") ? chart.presentationSuggestion : null,
					beats: Array.isArray(chart.beats) ? chart.beats.map(projectBeat) : []
				};
			}),
			traces: projectTraces(packageValue.conversionTrace)
		};
	}
	/** @param {unknown} value */
	function projectDefinition(value) {
		if (!isPlainRecord(value)) return null;
		const result = {};
		for (const key of Reflect.ownKeys(value)) {
			if (typeof key !== "string" || /hash/iu.test(key)) continue;
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (descriptor && "value" in descriptor && descriptor.enumerable) result[key] = descriptor.value;
		}
		return result;
	}
	/** @param {unknown} value */
	function projectTraces(value) {
		if (!isPlainRecord(value)) return null;
		return {
			boxing: Array.isArray(value.boxing) ? value.boxing.map((trace) => isPlainRecord(trace) ? {
				...pick(trace, [
					"chartId",
					"difficulty",
					"bpm",
					"recipeId",
					"rulesetId",
					"sourceDifficultyPath",
					"sourceBeatmapVersion",
					"converterProfile"
				]),
				optimizer: trace.optimizer,
				events: trace.events
			} : null) : [],
			flow: Array.isArray(value.flow) ? value.flow : null,
			...value.converterProfile ? { converterProfile: value.converterProfile } : {}
		};
	}
	/** @param {Record<string, unknown>} value @param {readonly string[]} keys */
	function pick(value, keys) {
		const result = {};
		for (const key of keys) {
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (descriptor && "value" in descriptor && descriptor.enumerable) result[key] = descriptor.value;
		}
		return result;
	}
	/** @param {unknown} beat */
	function projectBeat(beat) {
		if (!isPlainRecord(beat)) return null;
		return pick(beat, [
			"start",
			"end",
			"type",
			"eventId",
			"sourceEventIds",
			"hand",
			"placement",
			"direction",
			"angleOffset",
			"requiresDirection",
			"geometry",
			"gridMask",
			"startPlacement",
			"endPlacement",
			"startDirection",
			"endDirection",
			"tailPlacement",
			"checkpointCount",
			"modifier",
			"spatialTarget",
			"guardTarget",
			"checkpoint",
			"blockedCells"
		]);
	}
	/** @param {unknown} packageValue */
	async function semanticParityHash(packageValue) {
		return prefixedSha256(canonicalJson(semanticParityProjection(packageValue)));
	}
	//#endregion
	//#region ../aerobeat-web-content-authoring/src/validator.js
	/**
	* Validate the canonical browser-authored package before persistence/export.
	*
	* @param {unknown} packageValue
	* @returns {Promise<Readonly<{valid: boolean, issues: readonly Readonly<{code: string, path: string, message: string}>[], packageHash: string | null}>>}
	*/
	async function validateAuthoredPackage(packageValue) {
		const issues = [];
		const issue = (code, path, message) => issues.push(Object.freeze({
			code,
			path,
			message
		}));
		if (!isPlainRecord(packageValue)) {
			issue("package_invalid", "", "Package must be a plain record");
			return Object.freeze({
				valid: false,
				issues: Object.freeze(issues),
				packageHash: null
			});
		}
		let canonicalPackage;
		try {
			canonicalPackage = canonicalJson(packageValue);
			if (new TextEncoder().encode(canonicalPackage).byteLength > 67108864) throw new TypeError("Package exceeds the validation size limit");
		} catch (cause) {
			issue("package_serialization_invalid", "", cause instanceof Error ? cause.message : "Package cannot be serialized");
			return Object.freeze({
				valid: false,
				issues: Object.freeze(issues),
				packageHash: null
			});
		}
		if (packageValue.schemaId !== "aerobeat.song-package.v2" || packageValue.schemaVersion !== 2 || packageValue.packageVersion !== "2.0.0") issue("package_schema_invalid", "schemaId", "Package schema must be aerobeat.song-package.v2 version 2 / package 2.0.0");
		if (!nonEmpty(packageValue.packageId) || !nonEmpty(packageValue.songId)) issue("package_identity_invalid", "packageId", "Package and song identities are required");
		try {
			if (canonicalJson(packageValue.recipeDefinitions) !== canonicalJson(recipeDefinitions)) issue("recipe_definitions_invalid", "recipeDefinitions", "Recipe definitions must exactly match the frozen authoring contract");
			if (canonicalJson(packageValue.rulesetDefinitions) !== canonicalJson(rulesetDefinitions)) issue("ruleset_definitions_invalid", "rulesetDefinitions", "Ruleset definitions must exactly match the frozen authoring contract");
		} catch {
			issue("definitions_invalid", "recipeDefinitions", "Definitions must be canonical plain data");
		}
		if (!isPlainRecord(packageValue.source) || packageValue.source.flowObstacleContract !== "source_geometry_v1") issue("flow_obstacle_contract_invalid", "source.flowObstacleContract", "Package source must bind source_geometry_v1");
		const sourceProfile = isPlainRecord(packageValue.source) ? packageValue.source.converterProfile : void 0;
		const traceProfile = isPlainRecord(packageValue.conversionTrace) ? packageValue.conversionTrace.converterProfile : void 0;
		/** @type {Readonly<Record<string,unknown>> | null} */ let converterProfile = null;
		if (sourceProfile !== void 0 || traceProfile !== void 0) try {
			converterProfile = await normalizeConverterProfile(sourceProfile);
			if (canonicalJson(traceProfile) !== canonicalJson(converterProfile)) issue("converter_profile_trace_mismatch", "conversionTrace.converterProfile", "Conversion trace profile must exactly match package source provenance");
		} catch (cause) {
			issue("converter_profile_invalid", "source.converterProfile", cause instanceof Error ? cause.message : "Converter profile is invalid");
		}
		const conversionTrace = isPlainRecord(packageValue.conversionTrace) ? packageValue.conversionTrace : null;
		const boxingTraces = conversionTrace && Array.isArray(conversionTrace.boxing) ? conversionTrace.boxing : [];
		const flowTraces = conversionTrace && Array.isArray(conversionTrace.flow) ? conversionTrace.flow : [];
		for (let index = 0; index < boxingTraces.length; index += 1) {
			const trace = boxingTraces[index];
			const traceConverterProfile = isPlainRecord(trace) ? trace.converterProfile : void 0;
			if (converterProfile) try {
				if (canonicalJson(traceConverterProfile) !== canonicalJson(converterProfile)) issue("converter_profile_boxing_trace_mismatch", `conversionTrace.boxing[${index}].converterProfile`, "Every Boxing trace converter profile must exactly match package source provenance");
			} catch {
				issue("converter_profile_boxing_trace_mismatch", `conversionTrace.boxing[${index}].converterProfile`, "Every Boxing trace converter profile must exactly match package source provenance");
			}
			else if (traceConverterProfile !== void 0) issue("converter_profile_unbound", `conversionTrace.boxing[${index}].converterProfile`, "Boxing trace converter profile requires package source provenance");
		}
		for (let index = 0; index < flowTraces.length; index += 1) {
			if (isPlainRecord(flowTraces[index]) && flowTraces[index].converterProfile !== void 0) issue("converter_profile_flow_trace_forbidden", `conversionTrace.flow[${index}].converterProfile`, "Flow traces must not carry Boxing converter profile provenance");
			if (!isPlainRecord(flowTraces[index]) || flowTraces[index].flowObstacleContract !== "source_geometry_v1" || !isPlainRecord(packageValue.source) || flowTraces[index].sourceHash !== packageValue.source.sourceHash || flowTraces[index].sourceDifficultyPath !== packageValue.source.sourceDifficultyPath || flowTraces[index].sourceBeatmapVersion !== packageValue.source.sourceBeatmapVersion || flowTraces[index].sourceDifficultyHash !== packageValue.source.sourceDifficultyHash) issue("flow_obstacle_trace_invalid", `conversionTrace.flow[${index}]`, "Flow trace must bind source_geometry_v1 and exact raw difficulty provenance");
		}
		const charts = Array.isArray(packageValue.charts) ? packageValue.charts : [];
		if (charts.length !== 5) issue("chart_count_invalid", "charts", "One difficulty must contain Flow plus four Boxing charts");
		const chartIds = /* @__PURE__ */ new Set();
		const matrix = /* @__PURE__ */ new Set();
		let flowCount = 0;
		for (let index = 0; index < charts.length; index += 1) {
			const chart = charts[index];
			const path = `charts[${index}]`;
			if (!isPlainRecord(chart)) {
				issue("chart_invalid", path, "Chart must be a plain record");
				continue;
			}
			const chartId = String(chart.chartId ?? "");
			if (!chartId || chartIds.has(chartId)) issue("chart_identity_invalid", `${path}.chartId`, "Chart IDs must be non-empty and unique");
			chartIds.add(chartId);
			if (!Array.isArray(chart.beats)) {
				issue("chart_beats_invalid", `${path}.beats`, "Chart beats must be an array");
				continue;
			}
			if (chart.mode === "flow") {
				flowCount += 1;
				if (chart.schemaId !== "aerobeat.chart.flow.v2" || chart.schemaVersion !== 2 || chart.rulesetId !== "flow_grid_v2") issue("flow_chart_schema_invalid", path, "Flow chart must use source-geometry schema/ruleset v2");
				if (chart.beats.filter((beat) => isPlainRecord(beat) && beat.type === "obstacle").length > 128) issue("flow_obstacle_limit_exceeded", `${path}.beats`, `Flow chart exceeds the obstacle limit`);
				for (let beatIndex = 0; beatIndex < chart.beats.length; beatIndex += 1) validateFlowBeat(chart.beats[beatIndex], `${path}.beats[${beatIndex}]`, issue);
				continue;
			}
			if (chart.mode !== "boxing" || !isPlainRecord(chart.prototype)) {
				issue("boxing_chart_invalid", path, "Boxing chart prototype metadata is required");
				continue;
			}
			const prototype = chart.prototype;
			if (prototype.contractId !== "aerobeat.boxing.prototype.v1") issue("prototype_contract_invalid", `${path}.prototype.contractId`, "Prototype contract mismatch");
			if (!["row_family_balanced_height_v1", "cut_family_source_height_v1"].includes(String(prototype.recipeId))) issue("prototype_recipe_invalid", `${path}.prototype.recipeId`, "Unknown recipe");
			if (!["boxing_semantic_track_v1", "boxing_spatial_grid_v1"].includes(String(prototype.rulesetId))) issue("prototype_ruleset_invalid", `${path}.prototype.rulesetId`, "Unknown ruleset");
			if (prototype.recipeVersion !== "1.0.0" || prototype.rulesetVersion !== "1.0.0") issue("prototype_version_invalid", `${path}.prototype`, "Prototype recipe/ruleset versions must match frozen definitions");
			matrix.add(`${String(prototype.recipeId)}|${String(prototype.rulesetId)}`);
			for (const hashName of [
				"sourceHash",
				"recipeHash",
				"rulesetHash",
				"contentHash"
			]) if (!validHash$1(prototype[hashName])) issue("prototype_hash_invalid", `${path}.prototype.${hashName}`, "Hash must be sha256 plus 64 lowercase hexadecimal digits");
			if (converterProfile) try {
				if (canonicalJson(prototype.converterProfile) !== canonicalJson(converterProfile)) issue("converter_profile_chart_mismatch", `${path}.prototype.converterProfile`, "Chart converter profile must exactly match package provenance");
				const expectedContentHash = await prefixedSha256(canonicalJson({
					beats: chart.beats,
					recipeId: prototype.recipeId,
					rulesetId: prototype.rulesetId,
					sourceHash: prototype.sourceHash,
					converterProfile
				}));
				if (prototype.contentHash !== expectedContentHash) issue("converter_profile_content_hash_mismatch", `${path}.prototype.contentHash`, "Chart content hash must bind converter profile identity and generated beats");
			} catch {
				issue("converter_profile_chart_mismatch", `${path}.prototype.converterProfile`, "Chart converter profile is invalid");
			}
			else if (prototype.converterProfile !== void 0) issue("converter_profile_unbound", `${path}.prototype.converterProfile`, "Chart converter profile requires package source provenance");
			const modifiers = Array.isArray(prototype.modifiers) ? prototype.modifiers.map(String) : [];
			const normalizedModifiers = [...new Set(modifiers)].sort();
			const emittedModifiers = [...new Set(chart.beats.filter(isPlainRecord).map((beat) => beat.modifier).filter((value) => typeof value === "string"))];
			if (!Array.isArray(prototype.modifiers) || modifiers.some((modifier) => !supportedModifiers.includes(modifier)) || canonicalJson(modifiers) !== canonicalJson(normalizedModifiers) || emittedModifiers.some((modifier) => !modifiers.includes(modifier))) issue("prototype_modifiers_invalid", `${path}.prototype.modifiers`, "Prototype modifiers must be sorted unique recognized union including emitted modifiers");
			for (let beatIndex = 0; beatIndex < chart.beats.length; beatIndex += 1) validateBeat(chart.beats[beatIndex], `${path}.beats[${beatIndex}]`, issue);
		}
		if (flowCount !== 1 || matrix.size !== 4) issue("prototype_matrix_invalid", "charts", "Charts must contain one Flow and all four recipe/ruleset combinations");
		const sets = Array.isArray(packageValue.sets) ? packageValue.sets : [];
		if (sets.length !== charts.length || new Set(sets.filter(isPlainRecord).map((set) => set.setId)).size !== charts.length || sets.some((set) => !isPlainRecord(set) || !chartIds.has(String(set.chartId)) || set.songId !== packageValue.songId)) issue("set_identity_invalid", "sets", "Every chart requires a unique correctly-linked set");
		let packageHash = null;
		try {
			packageHash = await prefixedSha256(canonicalPackage);
		} catch (cause) {
			issue("package_serialization_invalid", "", cause instanceof Error ? cause.message : "Package cannot be serialized");
		}
		return Object.freeze({
			valid: issues.length === 0,
			issues: Object.freeze(issues),
			packageHash
		});
	}
	/** @param {unknown} beat @param {string} path @param {(code: string, path: string, message: string) => void} issue */
	function validateBeat(beat, path, issue) {
		if (!isPlainRecord(beat)) {
			issue("beat_invalid", path, "Beat must be a plain record");
			return;
		}
		if (!Number.isFinite(beat.start) || Number(beat.start) < 0 || !nonEmpty(beat.type)) issue("beat_shape_invalid", path, "Beat start/type are invalid");
		if (!nonEmpty(beat.eventId) || !Array.isArray(beat.sourceEventIds) || beat.sourceEventIds.some((entry) => !nonEmpty(entry))) issue("beat_lineage_invalid", path, "Boxing beat event/source IDs are required");
		if (String(beat.type) === "guard") {
			if (beat.timingWindowMs !== 180 || beat.evidenceFreshnessMs !== 150) issue("beat_timing_invalid", path, "Guard timing/freshness must match the frozen contract");
			if (!isPlainRecord(beat.guardTarget) || !integerRange(beat.guardTarget.leftCell, 0, 11) || !integerRange(beat.guardTarget.rightCell, 0, 11)) issue("guard_target_invalid", `${path}.guardTarget`, "Guard cells must use athlete 0..11 IDs");
			if (!isPlainRecord(beat.checkpoint) || beat.checkpoint.kind !== "instantaneous" || beat.checkpoint.timingWindowMs !== 180 || beat.checkpoint.freshnessMs !== 150) issue("guard_checkpoint_invalid", `${path}.checkpoint`, "Guard checkpoint must use frozen instantaneous timing");
		}
		if (/^(straight|hook|uppercut)_/u.test(String(beat.type))) {
			if (beat.timingWindowMs !== 180 || beat.evidenceFreshnessMs !== 150) issue("beat_timing_invalid", path, "Punch timing/freshness must match the frozen contract");
			if (!isPlainRecord(beat.spatialTarget) || !integerRange(beat.spatialTarget.targetCell, 0, 11) || !Array.isArray(beat.spatialTarget.acceptedSubcells) || beat.spatialTarget.acceptedSubcells.some((entry) => !integerRange(entry, 0, 47))) issue("spatial_target_invalid", `${path}.spatialTarget`, "Punch spatial target must use athlete grid/subgrid IDs");
		}
		if (/^(squat|weave_)/u.test(String(beat.type))) {
			if (!Array.isArray(beat.blockedCells) || beat.blockedCells.some((entry) => !integerRange(entry, 0, 11))) issue("blocked_cells_invalid", `${path}.blockedCells`, "Obstacle cells must use athlete 0..11 IDs");
			if (!isPlainRecord(beat.checkpoint) || beat.checkpoint.kind !== "instantaneous" || beat.checkpoint.timingWindowMs !== 180 || beat.checkpoint.freshnessMs !== 150 || !Array.isArray(beat.checkpoint.noseSafeCells)) issue("obstacle_checkpoint_invalid", `${path}.checkpoint`, "Avoidance checkpoint requires frozen timing and nose safe cells");
		}
	}
	/** @param {unknown} beat @param {string} path @param {(code: string, path: string, message: string) => void} issue */
	function validateFlowBeat(beat, path, issue) {
		if (!isPlainRecord(beat) || !Number.isFinite(beat.start) || Number(beat.start) < 0 || ![
			"note",
			"bomb",
			"obstacle",
			"arc",
			"burst"
		].includes(String(beat.type))) {
			issue("flow_beat_invalid", path, "Flow beat shape/type is invalid");
			return;
		}
		if (["note", "bomb"].includes(String(beat.type)) && !integerRange(beat.placement, 0, 11)) issue("flow_placement_invalid", `${path}.placement`, "Flow placement must be 0..11");
		if (String(beat.type) === "obstacle") {
			const keys = [
				"start",
				"end",
				"type",
				"geometry",
				"gridMask"
			];
			if (Reflect.ownKeys(beat).length !== keys.length || !keys.every((key) => Object.hasOwn(beat, key)) || !Number.isFinite(beat.end) || Number(beat.end) <= Number(beat.start) || Number(beat.end) > 144e3 || !isFlowObstacleGeometry(beat.geometry) || !isFlowObstacleGridMask(beat.gridMask, beat.geometry)) issue("flow_obstacle_invalid", path, "Flow obstacle geometry, interval, and derived grid mask must match exactly");
		}
		if (String(beat.type) === "arc" && (!Number.isFinite(beat.end) || !integerRange(beat.startPlacement, 0, 11) || !integerRange(beat.endPlacement, 0, 11) || !Number.isInteger(beat.startDirection) || !Number.isInteger(beat.endDirection))) issue("flow_arc_invalid", path, "Flow arc is invalid");
		if (String(beat.type) === "burst" && (!Number.isFinite(beat.end) || !integerRange(beat.placement, 0, 11) || !integerRange(beat.tailPlacement, 0, 11) || !Number.isInteger(beat.checkpointCount) || Number(beat.checkpointCount) < 1)) issue("flow_burst_invalid", path, "Flow burst is invalid");
	}
	/** @param {unknown} value */
	function nonEmpty(value) {
		return typeof value === "string" && value.trim().length > 0;
	}
	/** @param {unknown} value */
	function validHash$1(value) {
		return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
	}
	/** @param {unknown} value @param {number} minimum @param {number} maximum */
	function integerRange(value, minimum, maximum) {
		return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
	}
	//#endregion
	//#region ../aerobeat-web-content-authoring/src/worker-protocol.js
	/** @typedef {Parameters<typeof convertDifficulty>[1]} WorkerConversionOptions */
	/** @typedef {"v2" | "v3" | "v4"} BeatMapFormat */
	/**
	* Execute one strictly narrowed structured-clone-safe conversion request.
	*
	* @param {unknown} request
	* @param {{signal?: AbortSignal, onProgress?: (progress: number, phase: string) => void}} [runtime]
	*/
	async function executeWorkerConversion(request, runtime = {}) {
		const normalized = narrowRequest(request);
		if (normalized.options.converterProfile) normalized.options.converterProfile = await normalizeConverterProfile(normalized.options.converterProfile);
		checkAbort(runtime.signal);
		safeProgress(runtime.onProgress, .05, "parsing");
		const sourceSummary = parseBeatMapDifficulty(normalized.difficultyBytes, normalized.format);
		const exactDifficultyHash = await prefixedSha256(normalized.difficultyBytes);
		if (normalized.options.sourceDifficultyHash && normalized.options.sourceDifficultyHash !== exactDifficultyHash) throw workerError("difficulty_hash_mismatch", "Worker difficulty bytes do not match the verified source hash");
		normalized.options.sourceDifficultyHash = exactDifficultyHash;
		checkAbort(runtime.signal);
		const converted = await convertDifficulty(sourceSummary, normalized.options, (progress, phase) => {
			checkAbort(runtime.signal);
			safeProgress(runtime.onProgress, progress, phase);
		});
		checkAbort(runtime.signal);
		const validation = await validateAuthoredPackage(converted.package);
		if (!validation.valid) throw workerError("package_validation_failed", validation.issues.map((entry) => entry.code).join(", "));
		safeProgress(runtime.onProgress, .9, "validating");
		const parityHash = await semanticParityHash(converted.package);
		return deepFreeze({
			schema: "aerobeat/authoring_worker_result",
			version: 1,
			jobId: normalized.jobId,
			package: cloneData(converted.package),
			packageHash: validation.packageHash,
			sourceHash: converted.sourceHash,
			semanticParityHash: parityHash,
			traces: cloneData(converted.traces)
		});
	}
	/** @param {unknown} request @returns {{jobId: string, difficultyBytes: Uint8Array, format: BeatMapFormat, options: WorkerConversionOptions}} */
	function narrowRequest(request) {
		if (!hasExactDataKeys(request, [
			"schema",
			"version",
			"kind",
			"jobId",
			"manifest",
			"difficultyBytes",
			"options"
		])) throw workerError("worker_request_invalid", "Worker request shape is invalid");
		const record = request;
		if (record.schema !== "aerobeat/authoring_worker_request" || record.version !== 1 || record.kind !== "convert" || !boundedString(record.jobId, 128) || !record.jobId || !(record.difficultyBytes instanceof Uint8Array) || record.difficultyBytes.byteLength > 67108864) throw workerError("worker_request_invalid", "Worker request shape is invalid");
		if (!hasExactDataKeys(record.manifest, [
			"schemaId",
			"sourceFormatMajor",
			"infoPath",
			"songName",
			"songAuthorName",
			"levelAuthorName",
			"bpm",
			"audioPath",
			"audioContentHash",
			"selectedDifficulty",
			"sourceProvider",
			"sourceId",
			"sourceVersionHash"
		])) throw workerError("worker_request_invalid", "Worker manifest shape is invalid");
		const manifest = record.manifest;
		if (manifest.schemaId !== "aerobeat.authoring-source.v1" || !Number.isInteger(manifest.sourceFormatMajor) || ![
			2,
			3,
			4
		].includes(Number(manifest.sourceFormatMajor)) || typeof manifest.bpm !== "number" || !Number.isFinite(manifest.bpm) || manifest.bpm <= 0) throw workerError("worker_request_invalid", "Worker manifest values are invalid");
		for (const field of [
			"infoPath",
			"songName",
			"songAuthorName",
			"levelAuthorName",
			"audioPath",
			"sourceProvider",
			"sourceId",
			"sourceVersionHash"
		]) if (typeof manifest[field] !== "string" || String(manifest[field]).length > 1024) throw workerError("worker_request_invalid", "Worker manifest text is invalid");
		if (!optionalHash(manifest.audioContentHash)) throw workerError("worker_request_invalid", "Worker manifest audio hash is invalid");
		if (!hasExactDataKeys(manifest.selectedDifficulty, [
			"difficulty",
			"path",
			"contentHash"
		])) throw workerError("worker_request_invalid", "Worker selected difficulty shape is invalid");
		const selected = manifest.selectedDifficulty;
		if (!boundedString(selected.difficulty, 64) || !selected.difficulty || !boundedString(selected.path, 1024) || !selected.path || !validHash(selected.contentHash)) throw workerError("worker_request_invalid", "Worker selected difficulty values are invalid");
		const requiredOptions = [
			"difficulty",
			"songToken",
			"songName",
			"bpm",
			"sourceProvider",
			"sourceId",
			"sourceVersionHash",
			"sourceDifficultyPath",
			"sourceBeatmapVersion",
			"sourceDifficultyHash",
			"audioPath",
			"audioContentHash",
			"modifiers"
		];
		if (!hasOnlyDataKeys(record.options, requiredOptions, ["presentationSuggestion", "converterProfile"]) || !requiredOptions.every((key) => Object.hasOwn(record.options, key))) throw workerError("worker_request_invalid", "Worker conversion options are invalid");
		const conversionOptions = record.options;
		for (const field of [
			"difficulty",
			"songToken",
			"songName",
			"sourceProvider",
			"sourceId",
			"sourceVersionHash",
			"sourceDifficultyPath",
			"sourceBeatmapVersion",
			"audioPath"
		]) if (!boundedString(conversionOptions[field], 1024)) throw workerError("worker_request_invalid", "Worker conversion text is invalid");
		if (typeof conversionOptions.bpm !== "number" || !Number.isFinite(conversionOptions.bpm) || conversionOptions.bpm <= 0 || !validHash(conversionOptions.sourceDifficultyHash) || !optionalHash(conversionOptions.audioContentHash)) throw workerError("worker_request_invalid", "Worker conversion values are invalid");
		const modifiers = denseStringArray(conversionOptions.modifiers, supportedModifiers.length);
		if (new Set(modifiers).size !== modifiers.length || modifiers.some((value) => !supportedModifiers.includes(value))) throw workerError("worker_request_invalid", "Worker modifiers are invalid");
		const audioMatches = conversionOptions.audioPath === manifest.audioPath && conversionOptions.audioContentHash === manifest.audioContentHash || conversionOptions.audioPath === "" && conversionOptions.audioContentHash === "";
		if (conversionOptions.difficulty !== selected.difficulty || conversionOptions.sourceDifficultyPath !== selected.path || conversionOptions.sourceDifficultyHash !== selected.contentHash || conversionOptions.bpm !== manifest.bpm || conversionOptions.sourceProvider !== manifest.sourceProvider || conversionOptions.sourceId !== manifest.sourceId || conversionOptions.sourceVersionHash !== manifest.sourceVersionHash || !audioMatches) throw workerError("worker_request_invalid", "Worker options do not match the inspected manifest");
		if (Object.hasOwn(conversionOptions, "presentationSuggestion")) {
			if (!isPlainRecord(conversionOptions.presentationSuggestion)) throw workerError("worker_request_invalid", "Worker presentation suggestion is invalid");
			let encoded;
			try {
				encoded = canonicalJson(conversionOptions.presentationSuggestion);
			} catch {
				throw workerError("worker_request_invalid", "Worker presentation suggestion must contain plain data");
			}
			if (new TextEncoder().encode(encoded).byteLength > 65536) throw workerError("worker_request_invalid", "Worker presentation suggestion exceeds the size limit");
		}
		if (Object.hasOwn(conversionOptions, "converterProfile") && !converterProfileShape(conversionOptions.converterProfile)) throw workerError("worker_request_invalid", "Worker converter profile shape is invalid");
		const major = Number(manifest.sourceFormatMajor);
		const format = major === 2 ? "v2" : major === 3 ? "v3" : "v4";
		return {
			jobId: record.jobId,
			difficultyBytes: Uint8Array.from(record.difficultyBytes),
			format,
			options: cloneData(conversionOptions)
		};
	}
	/** @param {unknown} value */
	function converterProfileShape(value) {
		if (!hasExactDataKeys(value, [
			"schema",
			"version",
			"profileId",
			"profileVersion",
			"class",
			"label",
			"experimental",
			"settings",
			"contentHash"
		])) return false;
		const profile = value;
		if (profile.schema !== "aerobeat/prototype_profile" || profile.version !== 1 || profile.class !== "converter_regeneration" || profile.experimental !== true || !boundedString(profile.profileId, 128) || !profile.profileId || !boundedString(profile.profileVersion, 64) || !profile.profileVersion || !boundedString(profile.label, 256) || !profile.label || typeof profile.contentHash !== "string" || !/^[0-9a-f]{64}$/u.test(profile.contentHash)) return false;
		if (!hasExactDataKeys(profile.settings, ["guardRelocationRadius", "reachAllowanceSubcells"])) return false;
		const settings = profile.settings;
		return Number.isInteger(settings.guardRelocationRadius) && Number(settings.guardRelocationRadius) >= 0 && Number(settings.guardRelocationRadius) <= 8 && Number.isInteger(settings.reachAllowanceSubcells) && Number(settings.reachAllowanceSubcells) >= 0 && Number(settings.reachAllowanceSubcells) <= 8;
	}
	/** @param {unknown} value @param {readonly string[]} required */
	function hasExactDataKeys(value, required) {
		return hasOnlyDataKeys(value, required, []) && isPlainRecord(value) && Reflect.ownKeys(value).length === required.length;
	}
	/** @param {unknown} value @param {readonly string[]} required @param {readonly string[]} optional */
	function hasOnlyDataKeys(value, required, optional) {
		if (!isPlainRecord(value)) return false;
		const allowed = /* @__PURE__ */ new Set([...required, ...optional]);
		for (const key of Reflect.ownKeys(value)) {
			if (typeof key !== "string" || !allowed.has(key)) return false;
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || descriptor.value === void 0) return false;
		}
		return true;
	}
	/** @param {unknown} value @param {number} maximum */
	function boundedString(value, maximum) {
		return typeof value === "string" && value.length <= maximum;
	}
	/** @param {unknown} value */
	function validHash(value) {
		return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
	}
	/** @param {unknown} value */
	function optionalHash(value) {
		return value === "" || validHash(value);
	}
	/** @param {unknown} value @param {number} maximum */
	function denseStringArray(value, maximum) {
		if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) throw workerError("worker_request_invalid", "Worker array is invalid");
		if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || key !== "length" && (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length))) throw workerError("worker_request_invalid", "Worker array contains unsupported fields");
		const result = [];
		for (let index = 0; index < value.length; index += 1) {
			const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
			if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || typeof descriptor.value !== "string") throw workerError("worker_request_invalid", "Worker array must contain string data properties");
			result.push(descriptor.value);
		}
		return result;
	}
	/** @param {AbortSignal | undefined} signal */
	function checkAbort(signal) {
		if (signal?.aborted) throw workerError("operation_aborted", "Conversion was cancelled");
	}
	/** @param {((progress:number,phase:string)=>void) | undefined} listener @param {number} progress @param {string} phase */
	function safeProgress(listener, progress, phase) {
		try {
			listener?.(Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)), phase);
		} catch {}
	}
	/** @param {string} code @param {string} message */
	function workerError(code, message) {
		const error = new Error(message);
		error.name = "AeroAuthoringWorkerError";
		Object.assign(error, { code });
		return error;
	}
	//#endregion
	//#region ../aerobeat-web-content-authoring/src/conversion-worker.js
	const scope = globalThis;
	scope.onmessage = async (event) => {
		const request = event.data;
		const jobId = safeJobId(request);
		try {
			const result = await executeWorkerConversion(request, { onProgress(progress, phase) {
				scope.postMessage({
					schema: "aerobeat/authoring_worker_message",
					version: 1,
					kind: "progress",
					jobId,
					progress,
					phase
				});
			} });
			scope.postMessage({
				schema: "aerobeat/authoring_worker_message",
				version: 1,
				kind: "result",
				jobId,
				result
			});
		} catch (cause) {
			scope.postMessage({
				schema: "aerobeat/authoring_worker_message",
				version: 1,
				kind: "error",
				jobId,
				code: errorCode(cause),
				message: errorMessage(cause)
			});
		}
	};
	/** @param {unknown} value */
	function safeJobId(value) {
		if (value === null || typeof value !== "object" || Array.isArray(value)) return "";
		const descriptor = Object.getOwnPropertyDescriptor(value, "jobId");
		return descriptor && "value" in descriptor && typeof descriptor.value === "string" ? descriptor.value : "";
	}
	/** @param {unknown} value */
	function errorCode(value) {
		if (value === null || typeof value !== "object") return "worker_failed";
		const descriptor = Object.getOwnPropertyDescriptor(value, "code");
		return descriptor && "value" in descriptor && typeof descriptor.value === "string" ? descriptor.value.slice(0, 128) : "worker_failed";
	}
	/** @param {unknown} value */
	function errorMessage(value) {
		if (value && typeof value === "object") {
			const descriptor = Object.getOwnPropertyDescriptor(value, "message");
			if (descriptor && "value" in descriptor && typeof descriptor.value === "string") return descriptor.value.slice(0, 4096);
		}
		return "Worker conversion failed";
	}
	//#endregion
})();

//# sourceMappingURL=conversion-worker-lnuFDX2v.js.map