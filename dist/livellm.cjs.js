'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/**
 * Default configuration for LiveLLM.
 */
const DEFAULT_CONFIG = {
    theme: 'default',
    locale: 'en',
    debug: false,
    components: 'all',
    lazyLoad: true,
    transformer: {
        mode: 'auto',
        detectors: 'all',
        confidenceThreshold: 0.7,
    },
    markdown: {
        gfm: true,
        breaks: true,
        linkify: true,
        typographer: true,
    },
    renderer: {
        shadowDom: true,
        sanitize: true,
        proseStyles: true,
    },
    streaming: {
        enabled: true,
        skeletonDelay: 200,
        showCursor: true,
        autoScroll: true,
        cursorChar: '▊',
    },
    actions: {
        onAction: () => { },
        autoSend: false,
        showPreview: true,
        labelTemplates: {},
    },
    security: {
        enableCodeRunner: false,
        allowedOrigins: ['*'],
        maxJsonSize: 50000,
    },
    themeVars: {},
};
/**
 * Deep merge two config objects. Source overrides target.
 */
function mergeConfig(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        const val = source[key];
        if (val === undefined)
            continue;
        if (typeof val === 'object' &&
            val !== null &&
            !Array.isArray(val) &&
            typeof result[key] === 'object') {
            result[key] = { ...result[key], ...val };
        }
        else {
            result[key] = val;
        }
    }
    return result;
}

/**
 * @livellm/events — Central event bus.
 * All modules emit events through this bus.
 */
class EventBus {
    constructor() {
        this.handlers = {};
        this.debug = false;
    }
    setDebug(enabled) {
        this.debug = enabled;
    }
    /**
     * Register an event handler.
     */
    on(event, handler) {
        if (!this.handlers[event]) {
            this.handlers[event] = [];
        }
        this.handlers[event].push(handler);
    }
    /**
     * Remove an event handler.
     */
    off(event, handler) {
        const list = this.handlers[event];
        if (!list)
            return;
        const idx = list.indexOf(handler);
        if (idx !== -1) {
            list.splice(idx, 1);
        }
        if (list.length === 0) {
            delete this.handlers[event];
        }
    }
    /**
     * Register a one-time event handler.
     */
    once(event, handler) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            handler(...args);
        };
        this.on(event, wrapper);
    }
    /**
     * Emit an event to all registered handlers.
     */
    emit(event, ...args) {
        if (this.debug) {
            console.log(`[LiveLLM Event] ${event}`, ...args);
        }
        const list = this.handlers[event];
        if (!list)
            return;
        // Copy the list to avoid issues if handlers modify the list
        const snapshot = [...list];
        for (const handler of snapshot) {
            try {
                handler(...args);
            }
            catch (err) {
                console.error(`[LiveLLM] Error in event handler for "${event}":`, err);
            }
        }
    }
    /**
     * Remove all handlers for an event, or all handlers entirely.
     */
    removeAll(event) {
        if (event) {
            delete this.handlers[event];
        }
        else {
            this.handlers = {};
        }
    }
    /**
     * Get the count of handlers for an event.
     */
    listenerCount(event) {
        return this.handlers[event]?.length ?? 0;
    }
}

/**
 * Schema validation engine for component props.
 * Validates props against a ComponentSchema definition.
 */
function validateProps(schema, props) {
    const errors = [];
    // Check required fields and validate types
    for (const [key, def] of Object.entries(schema)) {
        const value = props[key];
        // Check required
        if (def.required && (value === undefined || value === null)) {
            errors.push({
                prop: key,
                message: `${key} is required`,
            });
            continue;
        }
        // Skip validation if optional and not provided
        if (value === undefined || value === null) {
            continue;
        }
        // Validate type
        const typeError = validateType(key, value, def);
        if (typeError) {
            errors.push(typeError);
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
function validateType(key, value, def) {
    switch (def.type) {
        case 'string':
            if (typeof value !== 'string') {
                return {
                    prop: key,
                    expected: 'string',
                    received: typeof value,
                    message: `${key} must be a string`,
                };
            }
            break;
        case 'number':
            if (typeof value !== 'number' || isNaN(value)) {
                return {
                    prop: key,
                    expected: 'number',
                    received: typeof value,
                    message: `${key} must be a number`,
                };
            }
            if (def.min !== undefined && value < def.min) {
                return {
                    prop: key,
                    message: `${key} must be >= ${def.min}`,
                };
            }
            if (def.max !== undefined && value > def.max) {
                return {
                    prop: key,
                    message: `${key} must be <= ${def.max}`,
                };
            }
            break;
        case 'boolean':
            if (typeof value !== 'boolean') {
                return {
                    prop: key,
                    expected: 'boolean',
                    received: typeof value,
                    message: `${key} must be a boolean`,
                };
            }
            break;
        case 'array':
            if (!Array.isArray(value)) {
                return {
                    prop: key,
                    expected: 'array',
                    received: typeof value,
                    message: `${key} must be an array`,
                };
            }
            break;
        case 'object':
            if (typeof value !== 'object' || Array.isArray(value)) {
                return {
                    prop: key,
                    expected: 'object',
                    received: Array.isArray(value) ? 'array' : typeof value,
                    message: `${key} must be an object`,
                };
            }
            break;
        case 'enum':
            if (def.enum && !def.enum.includes(value)) {
                return {
                    prop: key,
                    expected: `one of: ${def.enum.join(', ')}`,
                    received: String(value),
                    message: `${key} must be one of: ${def.enum.join(', ')}`,
                };
            }
            break;
    }
    return null;
}
/**
 * Apply defaults from schema to props.
 * Returns a new object with defaults filled in for missing optional props.
 */
function applyDefaults(schema, props) {
    const result = { ...props };
    for (const [key, def] of Object.entries(schema)) {
        if (result[key] === undefined && def.default !== undefined) {
            result[key] = def.default;
        }
    }
    return result;
}

const DEFAULT_SKELETON = {
    html: '<div class="livellm-skeleton"><div class="shimmer"></div></div>',
    height: '100px',
};
/**
 * @livellm/registry — Component registry.
 * Manages the catalog of available components, validation, and lazy loading.
 */
class Registry {
    constructor(events) {
        this.components = new Map();
        this.events = events;
    }
    /**
     * Register a component.
     */
    register(name, component, options = {}) {
        const tagName = `livellm-${name}`;
        const registration = {
            name,
            tagName,
            component,
            schema: options.schema || {},
            skeleton: options.skeleton || DEFAULT_SKELETON,
            category: options.category || 'block',
            lazy: options.lazy ?? (component === null),
            moduleUrl: options.moduleUrl || null,
        };
        this.components.set(name, registration);
        // Register the Custom Element if component class is provided and not already defined
        if (component && typeof customElements !== 'undefined') {
            if (!customElements.get(tagName)) {
                try {
                    customElements.define(tagName, component);
                }
                catch (err) {
                    console.error(`[LiveLLM Registry] Failed to define custom element <${tagName}>:`, err);
                }
            }
        }
        this.events.emit('registry:registered', name, registration);
    }
    /**
     * Check if a component is registered.
     */
    has(name) {
        return this.components.has(name);
    }
    /**
     * Get a component registration.
     */
    get(name) {
        return this.components.get(name);
    }
    /**
     * List all registered component names.
     */
    list() {
        return Array.from(this.components.keys());
    }
    /**
     * Remove a component from the registry.
     */
    remove(name) {
        const existed = this.components.delete(name);
        if (existed) {
            this.events.emit('registry:removed', name);
        }
        return existed;
    }
    /**
     * Validate props against a component's schema.
     */
    validate(name, props) {
        const registration = this.components.get(name);
        if (!registration) {
            return {
                valid: false,
                errors: [{ prop: '_component', message: `Component "${name}" is not registered` }],
            };
        }
        return validateProps(registration.schema, props);
    }
    /**
     * Apply defaults from schema and return completed props.
     */
    applyDefaults(name, props) {
        const registration = this.components.get(name);
        if (!registration)
            return props;
        return applyDefaults(registration.schema, props);
    }
    /**
     * Get the skeleton config for a component.
     */
    getSkeleton(name) {
        const registration = this.components.get(name);
        return registration?.skeleton || DEFAULT_SKELETON;
    }
    /**
     * Lazy-load a component by URL.
     */
    async loadComponent(name) {
        const registration = this.components.get(name);
        if (!registration)
            return false;
        if (!registration.lazy || registration.component)
            return true;
        if (!registration.moduleUrl)
            return false;
        this.events.emit('registry:lazy:loading', name, registration.moduleUrl);
        try {
            const module = await import(/* @vite-ignore */ registration.moduleUrl);
            const ComponentClass = module.default || module[`LiveLLM${capitalize(name)}`];
            if (!ComponentClass) {
                throw new Error(`Module does not export a component class for "${name}"`);
            }
            registration.component = ComponentClass;
            registration.lazy = false;
            // Register the custom element
            const tagName = registration.tagName;
            if (typeof customElements !== 'undefined' && !customElements.get(tagName)) {
                customElements.define(tagName, ComponentClass);
            }
            this.events.emit('registry:lazy:loaded', name);
            return true;
        }
        catch (err) {
            console.error(`[LiveLLM Registry] Failed to lazy-load "${name}":`, err);
            return false;
        }
    }
    /**
     * Clear all registrations.
     */
    clear() {
        this.components.clear();
    }
}
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/* eslint-disable no-bitwise */

const decodeCache = {};

function getDecodeCache (exclude) {
  let cache = decodeCache[exclude];
  if (cache) { return cache }

  cache = decodeCache[exclude] = [];

  for (let i = 0; i < 128; i++) {
    const ch = String.fromCharCode(i);
    cache.push(ch);
  }

  for (let i = 0; i < exclude.length; i++) {
    const ch = exclude.charCodeAt(i);
    cache[ch] = '%' + ('0' + ch.toString(16).toUpperCase()).slice(-2);
  }

  return cache
}

// Decode percent-encoded string.
//
function decode$1 (string, exclude) {
  if (typeof exclude !== 'string') {
    exclude = decode$1.defaultChars;
  }

  const cache = getDecodeCache(exclude);

  return string.replace(/(%[a-f0-9]{2})+/gi, function (seq) {
    let result = '';

    for (let i = 0, l = seq.length; i < l; i += 3) {
      const b1 = parseInt(seq.slice(i + 1, i + 3), 16);

      if (b1 < 0x80) {
        result += cache[b1];
        continue
      }

      if ((b1 & 0xE0) === 0xC0 && (i + 3 < l)) {
        // 110xxxxx 10xxxxxx
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);

        if ((b2 & 0xC0) === 0x80) {
          const chr = ((b1 << 6) & 0x7C0) | (b2 & 0x3F);

          if (chr < 0x80) {
            result += '\ufffd\ufffd';
          } else {
            result += String.fromCharCode(chr);
          }

          i += 3;
          continue
        }
      }

      if ((b1 & 0xF0) === 0xE0 && (i + 6 < l)) {
        // 1110xxxx 10xxxxxx 10xxxxxx
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        const b3 = parseInt(seq.slice(i + 7, i + 9), 16);

        if ((b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80) {
          const chr = ((b1 << 12) & 0xF000) | ((b2 << 6) & 0xFC0) | (b3 & 0x3F);

          if (chr < 0x800 || (chr >= 0xD800 && chr <= 0xDFFF)) {
            result += '\ufffd\ufffd\ufffd';
          } else {
            result += String.fromCharCode(chr);
          }

          i += 6;
          continue
        }
      }

      if ((b1 & 0xF8) === 0xF0 && (i + 9 < l)) {
        // 111110xx 10xxxxxx 10xxxxxx 10xxxxxx
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        const b3 = parseInt(seq.slice(i + 7, i + 9), 16);
        const b4 = parseInt(seq.slice(i + 10, i + 12), 16);

        if ((b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80 && (b4 & 0xC0) === 0x80) {
          let chr = ((b1 << 18) & 0x1C0000) | ((b2 << 12) & 0x3F000) | ((b3 << 6) & 0xFC0) | (b4 & 0x3F);

          if (chr < 0x10000 || chr > 0x10FFFF) {
            result += '\ufffd\ufffd\ufffd\ufffd';
          } else {
            chr -= 0x10000;
            result += String.fromCharCode(0xD800 + (chr >> 10), 0xDC00 + (chr & 0x3FF));
          }

          i += 9;
          continue
        }
      }

      result += '\ufffd';
    }

    return result
  })
}

decode$1.defaultChars = ';/?:@&=+$,#';
decode$1.componentChars = '';

const encodeCache = {};

// Create a lookup array where anything but characters in `chars` string
// and alphanumeric chars is percent-encoded.
//
function getEncodeCache (exclude) {
  let cache = encodeCache[exclude];
  if (cache) { return cache }

  cache = encodeCache[exclude] = [];

  for (let i = 0; i < 128; i++) {
    const ch = String.fromCharCode(i);

    if (/^[0-9a-z]$/i.test(ch)) {
      // always allow unencoded alphanumeric characters
      cache.push(ch);
    } else {
      cache.push('%' + ('0' + i.toString(16).toUpperCase()).slice(-2));
    }
  }

  for (let i = 0; i < exclude.length; i++) {
    cache[exclude.charCodeAt(i)] = exclude[i];
  }

  return cache
}

// Encode unsafe characters with percent-encoding, skipping already
// encoded sequences.
//
//  - string       - string to encode
//  - exclude      - list of characters to ignore (in addition to a-zA-Z0-9)
//  - keepEscaped  - don't encode '%' in a correct escape sequence (default: true)
//
function encode$1 (string, exclude, keepEscaped) {
  if (typeof exclude !== 'string') {
    // encode(string, keepEscaped)
    keepEscaped = exclude;
    exclude = encode$1.defaultChars;
  }

  if (typeof keepEscaped === 'undefined') {
    keepEscaped = true;
  }

  const cache = getEncodeCache(exclude);
  let result = '';

  for (let i = 0, l = string.length; i < l; i++) {
    const code = string.charCodeAt(i);

    if (keepEscaped && code === 0x25 /* % */ && i + 2 < l) {
      if (/^[0-9a-f]{2}$/i.test(string.slice(i + 1, i + 3))) {
        result += string.slice(i, i + 3);
        i += 2;
        continue
      }
    }

    if (code < 128) {
      result += cache[code];
      continue
    }

    if (code >= 0xD800 && code <= 0xDFFF) {
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < l) {
        const nextCode = string.charCodeAt(i + 1);
        if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
          result += encodeURIComponent(string[i] + string[i + 1]);
          i++;
          continue
        }
      }
      result += '%EF%BF%BD';
      continue
    }

    result += encodeURIComponent(string[i]);
  }

  return result
}

encode$1.defaultChars = ";/?:@&=+$,-_.!~*'()#";
encode$1.componentChars = "-_.!~*'()";

function format (url) {
  let result = '';

  result += url.protocol || '';
  result += url.slashes ? '//' : '';
  result += url.auth ? url.auth + '@' : '';

  if (url.hostname && url.hostname.indexOf(':') !== -1) {
    // ipv6 address
    result += '[' + url.hostname + ']';
  } else {
    result += url.hostname || '';
  }

  result += url.port ? ':' + url.port : '';
  result += url.pathname || '';
  result += url.search || '';
  result += url.hash || '';

  return result
}

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

//
// Changes from joyent/node:
//
// 1. No leading slash in paths,
//    e.g. in `url.parse('http://foo?bar')` pathname is ``, not `/`
//
// 2. Backslashes are not replaced with slashes,
//    so `http:\\example.org\` is treated like a relative path
//
// 3. Trailing colon is treated like a part of the path,
//    i.e. in `http://example.org:foo` pathname is `:foo`
//
// 4. Nothing is URL-encoded in the resulting object,
//    (in joyent/node some chars in auth and paths are encoded)
//
// 5. `url.parse()` does not have `parseQueryString` argument
//
// 6. Removed extraneous result properties: `host`, `path`, `query`, etc.,
//    which can be constructed using other parts of the url.
//

function Url () {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.pathname = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
const protocolPattern = /^([a-z0-9.+-]+:)/i;
const portPattern = /:[0-9]*$/;

// Special case for a simple path URL
/* eslint-disable-next-line no-useless-escape */
const simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/;

// RFC 2396: characters reserved for delimiting URLs.
// We actually just auto-escape these.
const delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'];

// RFC 2396: characters not allowed for various reasons.
const unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims);

// Allowed by RFCs, but cause of XSS attacks.  Always escape these.
const autoEscape = ['\''].concat(unwise);
// Characters that are never ever allowed in a hostname.
// Note that any invalid chars are also handled, but these
// are the ones that are *expected* to be seen, so we fast-path
// them.
const nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape);
const hostEndingChars = ['/', '?', '#'];
const hostnameMaxLen = 255;
const hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/;
const hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/;
// protocols that can allow "unsafe" and "unwise" chars.
// protocols that never have a hostname.
const hostlessProtocol = {
  javascript: true,
  'javascript:': true
};
// protocols that always contain a // bit.
const slashedProtocol = {
  http: true,
  https: true,
  ftp: true,
  gopher: true,
  file: true,
  'http:': true,
  'https:': true,
  'ftp:': true,
  'gopher:': true,
  'file:': true
};

function urlParse (url, slashesDenoteHost) {
  if (url && url instanceof Url) return url

  const u = new Url();
  u.parse(url, slashesDenoteHost);
  return u
}

Url.prototype.parse = function (url, slashesDenoteHost) {
  let lowerProto, hec, slashes;
  let rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  if (!slashesDenoteHost && url.split('#').length === 1) {
    // Try fast path regexp
    const simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
      }
      return this
    }
  }

  let proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    lowerProto = proto.toLowerCase();
    this.protocol = proto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  /* eslint-disable-next-line no-useless-escape */
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {
    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    let hostEnd = -1;
    for (let i = 0; i < hostEndingChars.length; i++) {
      hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    let auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = auth;
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (let i = 0; i < nonHostChars.length; i++) {
      hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1) {
      hostEnd = rest.length;
    }

    if (rest[hostEnd - 1] === ':') { hostEnd--; }
    const host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost(host);

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    const ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      const hostparts = this.hostname.split(/\./);
      for (let i = 0, l = hostparts.length; i < l; i++) {
        const part = hostparts[i];
        if (!part) { continue }
        if (!part.match(hostnamePartPattern)) {
          let newpart = '';
          for (let j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            const validParts = hostparts.slice(0, i);
            const notHost = hostparts.slice(i + 1);
            const bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    }

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
    }
  }

  // chop off from the tail first.
  const hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  const qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    rest = rest.slice(0, qm);
  }
  if (rest) { this.pathname = rest; }
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '';
  }

  return this
};

Url.prototype.parseHost = function (host) {
  let port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) { this.hostname = host; }
};

var mdurl = /*#__PURE__*/Object.freeze({
    __proto__: null,
    decode: decode$1,
    encode: encode$1,
    format: format,
    parse: urlParse
});

var Any = /[\0-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;

var Cc = /[\0-\x1F\x7F-\x9F]/;

var regex$1 = /[\xAD\u0600-\u0605\u061C\u06DD\u070F\u0890\u0891\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uD804[\uDCBD\uDCCD]|\uD80D[\uDC30-\uDC3F]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/;

var P = /[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061D-\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1B7D\u1B7E\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u2E52-\u2E5D\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDEAD\uDF55-\uDF59\uDF86-\uDF89]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5A\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDEB9\uDF3C-\uDF3E]|\uD806[\uDC3B\uDD44-\uDD46\uDDE2\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2\uDF00-\uDF09]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8\uDF43-\uDF4F\uDFFF]|\uD809[\uDC70-\uDC74]|\uD80B[\uDFF1\uDFF2]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDE97-\uDE9A\uDFE2]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/;

var regex = /[\$\+<->\^`\|~\xA2-\xA6\xA8\xA9\xAC\xAE-\xB1\xB4\xB8\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u02FF\u0375\u0384\u0385\u03F6\u0482\u058D-\u058F\u0606-\u0608\u060B\u060E\u060F\u06DE\u06E9\u06FD\u06FE\u07F6\u07FE\u07FF\u0888\u09F2\u09F3\u09FA\u09FB\u0AF1\u0B70\u0BF3-\u0BFA\u0C7F\u0D4F\u0D79\u0E3F\u0F01-\u0F03\u0F13\u0F15-\u0F17\u0F1A-\u0F1F\u0F34\u0F36\u0F38\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCE\u0FCF\u0FD5-\u0FD8\u109E\u109F\u1390-\u1399\u166D\u17DB\u1940\u19DE-\u19FF\u1B61-\u1B6A\u1B74-\u1B7C\u1FBD\u1FBF-\u1FC1\u1FCD-\u1FCF\u1FDD-\u1FDF\u1FED-\u1FEF\u1FFD\u1FFE\u2044\u2052\u207A-\u207C\u208A-\u208C\u20A0-\u20C0\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F\u218A\u218B\u2190-\u2307\u230C-\u2328\u232B-\u2426\u2440-\u244A\u249C-\u24E9\u2500-\u2767\u2794-\u27C4\u27C7-\u27E5\u27F0-\u2982\u2999-\u29D7\u29DC-\u29FB\u29FE-\u2B73\u2B76-\u2B95\u2B97-\u2BFF\u2CE5-\u2CEA\u2E50\u2E51\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFF\u3004\u3012\u3013\u3020\u3036\u3037\u303E\u303F\u309B\u309C\u3190\u3191\u3196-\u319F\u31C0-\u31E3\u31EF\u3200-\u321E\u322A-\u3247\u3250\u3260-\u327F\u328A-\u32B0\u32C0-\u33FF\u4DC0-\u4DFF\uA490-\uA4C6\uA700-\uA716\uA720\uA721\uA789\uA78A\uA828-\uA82B\uA836-\uA839\uAA77-\uAA79\uAB5B\uAB6A\uAB6B\uFB29\uFBB2-\uFBC2\uFD40-\uFD4F\uFDCF\uFDFC-\uFDFF\uFE62\uFE64-\uFE66\uFE69\uFF04\uFF0B\uFF1C-\uFF1E\uFF3E\uFF40\uFF5C\uFF5E\uFFE0-\uFFE6\uFFE8-\uFFEE\uFFFC\uFFFD]|\uD800[\uDD37-\uDD3F\uDD79-\uDD89\uDD8C-\uDD8E\uDD90-\uDD9C\uDDA0\uDDD0-\uDDFC]|\uD802[\uDC77\uDC78\uDEC8]|\uD805\uDF3F|\uD807[\uDFD5-\uDFF1]|\uD81A[\uDF3C-\uDF3F\uDF45]|\uD82F\uDC9C|\uD833[\uDF50-\uDFC3]|\uD834[\uDC00-\uDCF5\uDD00-\uDD26\uDD29-\uDD64\uDD6A-\uDD6C\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDDEA\uDE00-\uDE41\uDE45\uDF00-\uDF56]|\uD835[\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3]|\uD836[\uDC00-\uDDFF\uDE37-\uDE3A\uDE6D-\uDE74\uDE76-\uDE83\uDE85\uDE86]|\uD838[\uDD4F\uDEFF]|\uD83B[\uDCAC\uDCB0\uDD2E\uDEF0\uDEF1]|\uD83C[\uDC00-\uDC2B\uDC30-\uDC93\uDCA0-\uDCAE\uDCB1-\uDCBF\uDCC1-\uDCCF\uDCD1-\uDCF5\uDD0D-\uDDAD\uDDE6-\uDE02\uDE10-\uDE3B\uDE40-\uDE48\uDE50\uDE51\uDE60-\uDE65\uDF00-\uDFFF]|\uD83D[\uDC00-\uDED7\uDEDC-\uDEEC\uDEF0-\uDEFC\uDF00-\uDF76\uDF7B-\uDFD9\uDFE0-\uDFEB\uDFF0]|\uD83E[\uDC00-\uDC0B\uDC10-\uDC47\uDC50-\uDC59\uDC60-\uDC87\uDC90-\uDCAD\uDCB0\uDCB1\uDD00-\uDE53\uDE60-\uDE6D\uDE70-\uDE7C\uDE80-\uDE88\uDE90-\uDEBD\uDEBF-\uDEC5\uDECE-\uDEDB\uDEE0-\uDEE8\uDEF0-\uDEF8\uDF00-\uDF92\uDF94-\uDFCA]/;

var Z = /[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/;

var ucmicro = /*#__PURE__*/Object.freeze({
    __proto__: null,
    Any: Any,
    Cc: Cc,
    Cf: regex$1,
    P: P,
    S: regex,
    Z: Z
});

// Generated using scripts/write-decode-map.ts
var htmlDecodeTree = new Uint16Array(
// prettier-ignore
"\u1d41<\xd5\u0131\u028a\u049d\u057b\u05d0\u0675\u06de\u07a2\u07d6\u080f\u0a4a\u0a91\u0da1\u0e6d\u0f09\u0f26\u10ca\u1228\u12e1\u1415\u149d\u14c3\u14df\u1525\0\0\0\0\0\0\u156b\u16cd\u198d\u1c12\u1ddd\u1f7e\u2060\u21b0\u228d\u23c0\u23fb\u2442\u2824\u2912\u2d08\u2e48\u2fce\u3016\u32ba\u3639\u37ac\u38fe\u3a28\u3a71\u3ae0\u3b2e\u0800EMabcfglmnoprstu\\bfms\x7f\x84\x8b\x90\x95\x98\xa6\xb3\xb9\xc8\xcflig\u803b\xc6\u40c6P\u803b&\u4026cute\u803b\xc1\u40c1reve;\u4102\u0100iyx}rc\u803b\xc2\u40c2;\u4410r;\uc000\ud835\udd04rave\u803b\xc0\u40c0pha;\u4391acr;\u4100d;\u6a53\u0100gp\x9d\xa1on;\u4104f;\uc000\ud835\udd38plyFunction;\u6061ing\u803b\xc5\u40c5\u0100cs\xbe\xc3r;\uc000\ud835\udc9cign;\u6254ilde\u803b\xc3\u40c3ml\u803b\xc4\u40c4\u0400aceforsu\xe5\xfb\xfe\u0117\u011c\u0122\u0127\u012a\u0100cr\xea\xf2kslash;\u6216\u0176\xf6\xf8;\u6ae7ed;\u6306y;\u4411\u0180crt\u0105\u010b\u0114ause;\u6235noullis;\u612ca;\u4392r;\uc000\ud835\udd05pf;\uc000\ud835\udd39eve;\u42d8c\xf2\u0113mpeq;\u624e\u0700HOacdefhilorsu\u014d\u0151\u0156\u0180\u019e\u01a2\u01b5\u01b7\u01ba\u01dc\u0215\u0273\u0278\u027ecy;\u4427PY\u803b\xa9\u40a9\u0180cpy\u015d\u0162\u017aute;\u4106\u0100;i\u0167\u0168\u62d2talDifferentialD;\u6145leys;\u612d\u0200aeio\u0189\u018e\u0194\u0198ron;\u410cdil\u803b\xc7\u40c7rc;\u4108nint;\u6230ot;\u410a\u0100dn\u01a7\u01adilla;\u40b8terDot;\u40b7\xf2\u017fi;\u43a7rcle\u0200DMPT\u01c7\u01cb\u01d1\u01d6ot;\u6299inus;\u6296lus;\u6295imes;\u6297o\u0100cs\u01e2\u01f8kwiseContourIntegral;\u6232eCurly\u0100DQ\u0203\u020foubleQuote;\u601duote;\u6019\u0200lnpu\u021e\u0228\u0247\u0255on\u0100;e\u0225\u0226\u6237;\u6a74\u0180git\u022f\u0236\u023aruent;\u6261nt;\u622fourIntegral;\u622e\u0100fr\u024c\u024e;\u6102oduct;\u6210nterClockwiseContourIntegral;\u6233oss;\u6a2fcr;\uc000\ud835\udc9ep\u0100;C\u0284\u0285\u62d3ap;\u624d\u0580DJSZacefios\u02a0\u02ac\u02b0\u02b4\u02b8\u02cb\u02d7\u02e1\u02e6\u0333\u048d\u0100;o\u0179\u02a5trahd;\u6911cy;\u4402cy;\u4405cy;\u440f\u0180grs\u02bf\u02c4\u02c7ger;\u6021r;\u61a1hv;\u6ae4\u0100ay\u02d0\u02d5ron;\u410e;\u4414l\u0100;t\u02dd\u02de\u6207a;\u4394r;\uc000\ud835\udd07\u0100af\u02eb\u0327\u0100cm\u02f0\u0322ritical\u0200ADGT\u0300\u0306\u0316\u031ccute;\u40b4o\u0174\u030b\u030d;\u42d9bleAcute;\u42ddrave;\u4060ilde;\u42dcond;\u62c4ferentialD;\u6146\u0470\u033d\0\0\0\u0342\u0354\0\u0405f;\uc000\ud835\udd3b\u0180;DE\u0348\u0349\u034d\u40a8ot;\u60dcqual;\u6250ble\u0300CDLRUV\u0363\u0372\u0382\u03cf\u03e2\u03f8ontourIntegra\xec\u0239o\u0274\u0379\0\0\u037b\xbb\u0349nArrow;\u61d3\u0100eo\u0387\u03a4ft\u0180ART\u0390\u0396\u03a1rrow;\u61d0ightArrow;\u61d4e\xe5\u02cang\u0100LR\u03ab\u03c4eft\u0100AR\u03b3\u03b9rrow;\u67f8ightArrow;\u67faightArrow;\u67f9ight\u0100AT\u03d8\u03derrow;\u61d2ee;\u62a8p\u0241\u03e9\0\0\u03efrrow;\u61d1ownArrow;\u61d5erticalBar;\u6225n\u0300ABLRTa\u0412\u042a\u0430\u045e\u047f\u037crrow\u0180;BU\u041d\u041e\u0422\u6193ar;\u6913pArrow;\u61f5reve;\u4311eft\u02d2\u043a\0\u0446\0\u0450ightVector;\u6950eeVector;\u695eector\u0100;B\u0459\u045a\u61bdar;\u6956ight\u01d4\u0467\0\u0471eeVector;\u695fector\u0100;B\u047a\u047b\u61c1ar;\u6957ee\u0100;A\u0486\u0487\u62a4rrow;\u61a7\u0100ct\u0492\u0497r;\uc000\ud835\udc9frok;\u4110\u0800NTacdfglmopqstux\u04bd\u04c0\u04c4\u04cb\u04de\u04e2\u04e7\u04ee\u04f5\u0521\u052f\u0536\u0552\u055d\u0560\u0565G;\u414aH\u803b\xd0\u40d0cute\u803b\xc9\u40c9\u0180aiy\u04d2\u04d7\u04dcron;\u411arc\u803b\xca\u40ca;\u442dot;\u4116r;\uc000\ud835\udd08rave\u803b\xc8\u40c8ement;\u6208\u0100ap\u04fa\u04fecr;\u4112ty\u0253\u0506\0\0\u0512mallSquare;\u65fberySmallSquare;\u65ab\u0100gp\u0526\u052aon;\u4118f;\uc000\ud835\udd3csilon;\u4395u\u0100ai\u053c\u0549l\u0100;T\u0542\u0543\u6a75ilde;\u6242librium;\u61cc\u0100ci\u0557\u055ar;\u6130m;\u6a73a;\u4397ml\u803b\xcb\u40cb\u0100ip\u056a\u056fsts;\u6203onentialE;\u6147\u0280cfios\u0585\u0588\u058d\u05b2\u05ccy;\u4424r;\uc000\ud835\udd09lled\u0253\u0597\0\0\u05a3mallSquare;\u65fcerySmallSquare;\u65aa\u0370\u05ba\0\u05bf\0\0\u05c4f;\uc000\ud835\udd3dAll;\u6200riertrf;\u6131c\xf2\u05cb\u0600JTabcdfgorst\u05e8\u05ec\u05ef\u05fa\u0600\u0612\u0616\u061b\u061d\u0623\u066c\u0672cy;\u4403\u803b>\u403emma\u0100;d\u05f7\u05f8\u4393;\u43dcreve;\u411e\u0180eiy\u0607\u060c\u0610dil;\u4122rc;\u411c;\u4413ot;\u4120r;\uc000\ud835\udd0a;\u62d9pf;\uc000\ud835\udd3eeater\u0300EFGLST\u0635\u0644\u064e\u0656\u065b\u0666qual\u0100;L\u063e\u063f\u6265ess;\u62dbullEqual;\u6267reater;\u6aa2ess;\u6277lantEqual;\u6a7eilde;\u6273cr;\uc000\ud835\udca2;\u626b\u0400Aacfiosu\u0685\u068b\u0696\u069b\u069e\u06aa\u06be\u06caRDcy;\u442a\u0100ct\u0690\u0694ek;\u42c7;\u405eirc;\u4124r;\u610clbertSpace;\u610b\u01f0\u06af\0\u06b2f;\u610dizontalLine;\u6500\u0100ct\u06c3\u06c5\xf2\u06a9rok;\u4126mp\u0144\u06d0\u06d8ownHum\xf0\u012fqual;\u624f\u0700EJOacdfgmnostu\u06fa\u06fe\u0703\u0707\u070e\u071a\u071e\u0721\u0728\u0744\u0778\u078b\u078f\u0795cy;\u4415lig;\u4132cy;\u4401cute\u803b\xcd\u40cd\u0100iy\u0713\u0718rc\u803b\xce\u40ce;\u4418ot;\u4130r;\u6111rave\u803b\xcc\u40cc\u0180;ap\u0720\u072f\u073f\u0100cg\u0734\u0737r;\u412ainaryI;\u6148lie\xf3\u03dd\u01f4\u0749\0\u0762\u0100;e\u074d\u074e\u622c\u0100gr\u0753\u0758ral;\u622bsection;\u62c2isible\u0100CT\u076c\u0772omma;\u6063imes;\u6062\u0180gpt\u077f\u0783\u0788on;\u412ef;\uc000\ud835\udd40a;\u4399cr;\u6110ilde;\u4128\u01eb\u079a\0\u079ecy;\u4406l\u803b\xcf\u40cf\u0280cfosu\u07ac\u07b7\u07bc\u07c2\u07d0\u0100iy\u07b1\u07b5rc;\u4134;\u4419r;\uc000\ud835\udd0dpf;\uc000\ud835\udd41\u01e3\u07c7\0\u07ccr;\uc000\ud835\udca5rcy;\u4408kcy;\u4404\u0380HJacfos\u07e4\u07e8\u07ec\u07f1\u07fd\u0802\u0808cy;\u4425cy;\u440cppa;\u439a\u0100ey\u07f6\u07fbdil;\u4136;\u441ar;\uc000\ud835\udd0epf;\uc000\ud835\udd42cr;\uc000\ud835\udca6\u0580JTaceflmost\u0825\u0829\u082c\u0850\u0863\u09b3\u09b8\u09c7\u09cd\u0a37\u0a47cy;\u4409\u803b<\u403c\u0280cmnpr\u0837\u083c\u0841\u0844\u084dute;\u4139bda;\u439bg;\u67ealacetrf;\u6112r;\u619e\u0180aey\u0857\u085c\u0861ron;\u413ddil;\u413b;\u441b\u0100fs\u0868\u0970t\u0500ACDFRTUVar\u087e\u08a9\u08b1\u08e0\u08e6\u08fc\u092f\u095b\u0390\u096a\u0100nr\u0883\u088fgleBracket;\u67e8row\u0180;BR\u0899\u089a\u089e\u6190ar;\u61e4ightArrow;\u61c6eiling;\u6308o\u01f5\u08b7\0\u08c3bleBracket;\u67e6n\u01d4\u08c8\0\u08d2eeVector;\u6961ector\u0100;B\u08db\u08dc\u61c3ar;\u6959loor;\u630aight\u0100AV\u08ef\u08f5rrow;\u6194ector;\u694e\u0100er\u0901\u0917e\u0180;AV\u0909\u090a\u0910\u62a3rrow;\u61a4ector;\u695aiangle\u0180;BE\u0924\u0925\u0929\u62b2ar;\u69cfqual;\u62b4p\u0180DTV\u0937\u0942\u094cownVector;\u6951eeVector;\u6960ector\u0100;B\u0956\u0957\u61bfar;\u6958ector\u0100;B\u0965\u0966\u61bcar;\u6952ight\xe1\u039cs\u0300EFGLST\u097e\u098b\u0995\u099d\u09a2\u09adqualGreater;\u62daullEqual;\u6266reater;\u6276ess;\u6aa1lantEqual;\u6a7dilde;\u6272r;\uc000\ud835\udd0f\u0100;e\u09bd\u09be\u62d8ftarrow;\u61daidot;\u413f\u0180npw\u09d4\u0a16\u0a1bg\u0200LRlr\u09de\u09f7\u0a02\u0a10eft\u0100AR\u09e6\u09ecrrow;\u67f5ightArrow;\u67f7ightArrow;\u67f6eft\u0100ar\u03b3\u0a0aight\xe1\u03bfight\xe1\u03caf;\uc000\ud835\udd43er\u0100LR\u0a22\u0a2ceftArrow;\u6199ightArrow;\u6198\u0180cht\u0a3e\u0a40\u0a42\xf2\u084c;\u61b0rok;\u4141;\u626a\u0400acefiosu\u0a5a\u0a5d\u0a60\u0a77\u0a7c\u0a85\u0a8b\u0a8ep;\u6905y;\u441c\u0100dl\u0a65\u0a6fiumSpace;\u605flintrf;\u6133r;\uc000\ud835\udd10nusPlus;\u6213pf;\uc000\ud835\udd44c\xf2\u0a76;\u439c\u0480Jacefostu\u0aa3\u0aa7\u0aad\u0ac0\u0b14\u0b19\u0d91\u0d97\u0d9ecy;\u440acute;\u4143\u0180aey\u0ab4\u0ab9\u0aberon;\u4147dil;\u4145;\u441d\u0180gsw\u0ac7\u0af0\u0b0eative\u0180MTV\u0ad3\u0adf\u0ae8ediumSpace;\u600bhi\u0100cn\u0ae6\u0ad8\xeb\u0ad9eryThi\xee\u0ad9ted\u0100GL\u0af8\u0b06reaterGreate\xf2\u0673essLes\xf3\u0a48Line;\u400ar;\uc000\ud835\udd11\u0200Bnpt\u0b22\u0b28\u0b37\u0b3areak;\u6060BreakingSpace;\u40a0f;\u6115\u0680;CDEGHLNPRSTV\u0b55\u0b56\u0b6a\u0b7c\u0ba1\u0beb\u0c04\u0c5e\u0c84\u0ca6\u0cd8\u0d61\u0d85\u6aec\u0100ou\u0b5b\u0b64ngruent;\u6262pCap;\u626doubleVerticalBar;\u6226\u0180lqx\u0b83\u0b8a\u0b9bement;\u6209ual\u0100;T\u0b92\u0b93\u6260ilde;\uc000\u2242\u0338ists;\u6204reater\u0380;EFGLST\u0bb6\u0bb7\u0bbd\u0bc9\u0bd3\u0bd8\u0be5\u626fqual;\u6271ullEqual;\uc000\u2267\u0338reater;\uc000\u226b\u0338ess;\u6279lantEqual;\uc000\u2a7e\u0338ilde;\u6275ump\u0144\u0bf2\u0bfdownHump;\uc000\u224e\u0338qual;\uc000\u224f\u0338e\u0100fs\u0c0a\u0c27tTriangle\u0180;BE\u0c1a\u0c1b\u0c21\u62eaar;\uc000\u29cf\u0338qual;\u62ecs\u0300;EGLST\u0c35\u0c36\u0c3c\u0c44\u0c4b\u0c58\u626equal;\u6270reater;\u6278ess;\uc000\u226a\u0338lantEqual;\uc000\u2a7d\u0338ilde;\u6274ested\u0100GL\u0c68\u0c79reaterGreater;\uc000\u2aa2\u0338essLess;\uc000\u2aa1\u0338recedes\u0180;ES\u0c92\u0c93\u0c9b\u6280qual;\uc000\u2aaf\u0338lantEqual;\u62e0\u0100ei\u0cab\u0cb9verseElement;\u620cghtTriangle\u0180;BE\u0ccb\u0ccc\u0cd2\u62ebar;\uc000\u29d0\u0338qual;\u62ed\u0100qu\u0cdd\u0d0cuareSu\u0100bp\u0ce8\u0cf9set\u0100;E\u0cf0\u0cf3\uc000\u228f\u0338qual;\u62e2erset\u0100;E\u0d03\u0d06\uc000\u2290\u0338qual;\u62e3\u0180bcp\u0d13\u0d24\u0d4eset\u0100;E\u0d1b\u0d1e\uc000\u2282\u20d2qual;\u6288ceeds\u0200;EST\u0d32\u0d33\u0d3b\u0d46\u6281qual;\uc000\u2ab0\u0338lantEqual;\u62e1ilde;\uc000\u227f\u0338erset\u0100;E\u0d58\u0d5b\uc000\u2283\u20d2qual;\u6289ilde\u0200;EFT\u0d6e\u0d6f\u0d75\u0d7f\u6241qual;\u6244ullEqual;\u6247ilde;\u6249erticalBar;\u6224cr;\uc000\ud835\udca9ilde\u803b\xd1\u40d1;\u439d\u0700Eacdfgmoprstuv\u0dbd\u0dc2\u0dc9\u0dd5\u0ddb\u0de0\u0de7\u0dfc\u0e02\u0e20\u0e22\u0e32\u0e3f\u0e44lig;\u4152cute\u803b\xd3\u40d3\u0100iy\u0dce\u0dd3rc\u803b\xd4\u40d4;\u441eblac;\u4150r;\uc000\ud835\udd12rave\u803b\xd2\u40d2\u0180aei\u0dee\u0df2\u0df6cr;\u414cga;\u43a9cron;\u439fpf;\uc000\ud835\udd46enCurly\u0100DQ\u0e0e\u0e1aoubleQuote;\u601cuote;\u6018;\u6a54\u0100cl\u0e27\u0e2cr;\uc000\ud835\udcaaash\u803b\xd8\u40d8i\u016c\u0e37\u0e3cde\u803b\xd5\u40d5es;\u6a37ml\u803b\xd6\u40d6er\u0100BP\u0e4b\u0e60\u0100ar\u0e50\u0e53r;\u603eac\u0100ek\u0e5a\u0e5c;\u63deet;\u63b4arenthesis;\u63dc\u0480acfhilors\u0e7f\u0e87\u0e8a\u0e8f\u0e92\u0e94\u0e9d\u0eb0\u0efcrtialD;\u6202y;\u441fr;\uc000\ud835\udd13i;\u43a6;\u43a0usMinus;\u40b1\u0100ip\u0ea2\u0eadncareplan\xe5\u069df;\u6119\u0200;eio\u0eb9\u0eba\u0ee0\u0ee4\u6abbcedes\u0200;EST\u0ec8\u0ec9\u0ecf\u0eda\u627aqual;\u6aaflantEqual;\u627cilde;\u627eme;\u6033\u0100dp\u0ee9\u0eeeuct;\u620fortion\u0100;a\u0225\u0ef9l;\u621d\u0100ci\u0f01\u0f06r;\uc000\ud835\udcab;\u43a8\u0200Ufos\u0f11\u0f16\u0f1b\u0f1fOT\u803b\"\u4022r;\uc000\ud835\udd14pf;\u611acr;\uc000\ud835\udcac\u0600BEacefhiorsu\u0f3e\u0f43\u0f47\u0f60\u0f73\u0fa7\u0faa\u0fad\u1096\u10a9\u10b4\u10bearr;\u6910G\u803b\xae\u40ae\u0180cnr\u0f4e\u0f53\u0f56ute;\u4154g;\u67ebr\u0100;t\u0f5c\u0f5d\u61a0l;\u6916\u0180aey\u0f67\u0f6c\u0f71ron;\u4158dil;\u4156;\u4420\u0100;v\u0f78\u0f79\u611cerse\u0100EU\u0f82\u0f99\u0100lq\u0f87\u0f8eement;\u620builibrium;\u61cbpEquilibrium;\u696fr\xbb\u0f79o;\u43a1ght\u0400ACDFTUVa\u0fc1\u0feb\u0ff3\u1022\u1028\u105b\u1087\u03d8\u0100nr\u0fc6\u0fd2gleBracket;\u67e9row\u0180;BL\u0fdc\u0fdd\u0fe1\u6192ar;\u61e5eftArrow;\u61c4eiling;\u6309o\u01f5\u0ff9\0\u1005bleBracket;\u67e7n\u01d4\u100a\0\u1014eeVector;\u695dector\u0100;B\u101d\u101e\u61c2ar;\u6955loor;\u630b\u0100er\u102d\u1043e\u0180;AV\u1035\u1036\u103c\u62a2rrow;\u61a6ector;\u695biangle\u0180;BE\u1050\u1051\u1055\u62b3ar;\u69d0qual;\u62b5p\u0180DTV\u1063\u106e\u1078ownVector;\u694feeVector;\u695cector\u0100;B\u1082\u1083\u61bear;\u6954ector\u0100;B\u1091\u1092\u61c0ar;\u6953\u0100pu\u109b\u109ef;\u611dndImplies;\u6970ightarrow;\u61db\u0100ch\u10b9\u10bcr;\u611b;\u61b1leDelayed;\u69f4\u0680HOacfhimoqstu\u10e4\u10f1\u10f7\u10fd\u1119\u111e\u1151\u1156\u1161\u1167\u11b5\u11bb\u11bf\u0100Cc\u10e9\u10eeHcy;\u4429y;\u4428FTcy;\u442ccute;\u415a\u0280;aeiy\u1108\u1109\u110e\u1113\u1117\u6abcron;\u4160dil;\u415erc;\u415c;\u4421r;\uc000\ud835\udd16ort\u0200DLRU\u112a\u1134\u113e\u1149ownArrow\xbb\u041eeftArrow\xbb\u089aightArrow\xbb\u0fddpArrow;\u6191gma;\u43a3allCircle;\u6218pf;\uc000\ud835\udd4a\u0272\u116d\0\0\u1170t;\u621aare\u0200;ISU\u117b\u117c\u1189\u11af\u65a1ntersection;\u6293u\u0100bp\u118f\u119eset\u0100;E\u1197\u1198\u628fqual;\u6291erset\u0100;E\u11a8\u11a9\u6290qual;\u6292nion;\u6294cr;\uc000\ud835\udcaear;\u62c6\u0200bcmp\u11c8\u11db\u1209\u120b\u0100;s\u11cd\u11ce\u62d0et\u0100;E\u11cd\u11d5qual;\u6286\u0100ch\u11e0\u1205eeds\u0200;EST\u11ed\u11ee\u11f4\u11ff\u627bqual;\u6ab0lantEqual;\u627dilde;\u627fTh\xe1\u0f8c;\u6211\u0180;es\u1212\u1213\u1223\u62d1rset\u0100;E\u121c\u121d\u6283qual;\u6287et\xbb\u1213\u0580HRSacfhiors\u123e\u1244\u1249\u1255\u125e\u1271\u1276\u129f\u12c2\u12c8\u12d1ORN\u803b\xde\u40deADE;\u6122\u0100Hc\u124e\u1252cy;\u440by;\u4426\u0100bu\u125a\u125c;\u4009;\u43a4\u0180aey\u1265\u126a\u126fron;\u4164dil;\u4162;\u4422r;\uc000\ud835\udd17\u0100ei\u127b\u1289\u01f2\u1280\0\u1287efore;\u6234a;\u4398\u0100cn\u128e\u1298kSpace;\uc000\u205f\u200aSpace;\u6009lde\u0200;EFT\u12ab\u12ac\u12b2\u12bc\u623cqual;\u6243ullEqual;\u6245ilde;\u6248pf;\uc000\ud835\udd4bipleDot;\u60db\u0100ct\u12d6\u12dbr;\uc000\ud835\udcafrok;\u4166\u0ae1\u12f7\u130e\u131a\u1326\0\u132c\u1331\0\0\0\0\0\u1338\u133d\u1377\u1385\0\u13ff\u1404\u140a\u1410\u0100cr\u12fb\u1301ute\u803b\xda\u40dar\u0100;o\u1307\u1308\u619fcir;\u6949r\u01e3\u1313\0\u1316y;\u440eve;\u416c\u0100iy\u131e\u1323rc\u803b\xdb\u40db;\u4423blac;\u4170r;\uc000\ud835\udd18rave\u803b\xd9\u40d9acr;\u416a\u0100di\u1341\u1369er\u0100BP\u1348\u135d\u0100ar\u134d\u1350r;\u405fac\u0100ek\u1357\u1359;\u63dfet;\u63b5arenthesis;\u63ddon\u0100;P\u1370\u1371\u62c3lus;\u628e\u0100gp\u137b\u137fon;\u4172f;\uc000\ud835\udd4c\u0400ADETadps\u1395\u13ae\u13b8\u13c4\u03e8\u13d2\u13d7\u13f3rrow\u0180;BD\u1150\u13a0\u13a4ar;\u6912ownArrow;\u61c5ownArrow;\u6195quilibrium;\u696eee\u0100;A\u13cb\u13cc\u62a5rrow;\u61a5own\xe1\u03f3er\u0100LR\u13de\u13e8eftArrow;\u6196ightArrow;\u6197i\u0100;l\u13f9\u13fa\u43d2on;\u43a5ing;\u416ecr;\uc000\ud835\udcb0ilde;\u4168ml\u803b\xdc\u40dc\u0480Dbcdefosv\u1427\u142c\u1430\u1433\u143e\u1485\u148a\u1490\u1496ash;\u62abar;\u6aeby;\u4412ash\u0100;l\u143b\u143c\u62a9;\u6ae6\u0100er\u1443\u1445;\u62c1\u0180bty\u144c\u1450\u147aar;\u6016\u0100;i\u144f\u1455cal\u0200BLST\u1461\u1465\u146a\u1474ar;\u6223ine;\u407ceparator;\u6758ilde;\u6240ThinSpace;\u600ar;\uc000\ud835\udd19pf;\uc000\ud835\udd4dcr;\uc000\ud835\udcb1dash;\u62aa\u0280cefos\u14a7\u14ac\u14b1\u14b6\u14bcirc;\u4174dge;\u62c0r;\uc000\ud835\udd1apf;\uc000\ud835\udd4ecr;\uc000\ud835\udcb2\u0200fios\u14cb\u14d0\u14d2\u14d8r;\uc000\ud835\udd1b;\u439epf;\uc000\ud835\udd4fcr;\uc000\ud835\udcb3\u0480AIUacfosu\u14f1\u14f5\u14f9\u14fd\u1504\u150f\u1514\u151a\u1520cy;\u442fcy;\u4407cy;\u442ecute\u803b\xdd\u40dd\u0100iy\u1509\u150drc;\u4176;\u442br;\uc000\ud835\udd1cpf;\uc000\ud835\udd50cr;\uc000\ud835\udcb4ml;\u4178\u0400Hacdefos\u1535\u1539\u153f\u154b\u154f\u155d\u1560\u1564cy;\u4416cute;\u4179\u0100ay\u1544\u1549ron;\u417d;\u4417ot;\u417b\u01f2\u1554\0\u155boWidt\xe8\u0ad9a;\u4396r;\u6128pf;\u6124cr;\uc000\ud835\udcb5\u0be1\u1583\u158a\u1590\0\u15b0\u15b6\u15bf\0\0\0\0\u15c6\u15db\u15eb\u165f\u166d\0\u1695\u169b\u16b2\u16b9\0\u16becute\u803b\xe1\u40e1reve;\u4103\u0300;Ediuy\u159c\u159d\u15a1\u15a3\u15a8\u15ad\u623e;\uc000\u223e\u0333;\u623frc\u803b\xe2\u40e2te\u80bb\xb4\u0306;\u4430lig\u803b\xe6\u40e6\u0100;r\xb2\u15ba;\uc000\ud835\udd1erave\u803b\xe0\u40e0\u0100ep\u15ca\u15d6\u0100fp\u15cf\u15d4sym;\u6135\xe8\u15d3ha;\u43b1\u0100ap\u15dfc\u0100cl\u15e4\u15e7r;\u4101g;\u6a3f\u0264\u15f0\0\0\u160a\u0280;adsv\u15fa\u15fb\u15ff\u1601\u1607\u6227nd;\u6a55;\u6a5clope;\u6a58;\u6a5a\u0380;elmrsz\u1618\u1619\u161b\u161e\u163f\u164f\u1659\u6220;\u69a4e\xbb\u1619sd\u0100;a\u1625\u1626\u6221\u0461\u1630\u1632\u1634\u1636\u1638\u163a\u163c\u163e;\u69a8;\u69a9;\u69aa;\u69ab;\u69ac;\u69ad;\u69ae;\u69aft\u0100;v\u1645\u1646\u621fb\u0100;d\u164c\u164d\u62be;\u699d\u0100pt\u1654\u1657h;\u6222\xbb\xb9arr;\u637c\u0100gp\u1663\u1667on;\u4105f;\uc000\ud835\udd52\u0380;Eaeiop\u12c1\u167b\u167d\u1682\u1684\u1687\u168a;\u6a70cir;\u6a6f;\u624ad;\u624bs;\u4027rox\u0100;e\u12c1\u1692\xf1\u1683ing\u803b\xe5\u40e5\u0180cty\u16a1\u16a6\u16a8r;\uc000\ud835\udcb6;\u402amp\u0100;e\u12c1\u16af\xf1\u0288ilde\u803b\xe3\u40e3ml\u803b\xe4\u40e4\u0100ci\u16c2\u16c8onin\xf4\u0272nt;\u6a11\u0800Nabcdefiklnoprsu\u16ed\u16f1\u1730\u173c\u1743\u1748\u1778\u177d\u17e0\u17e6\u1839\u1850\u170d\u193d\u1948\u1970ot;\u6aed\u0100cr\u16f6\u171ek\u0200ceps\u1700\u1705\u170d\u1713ong;\u624cpsilon;\u43f6rime;\u6035im\u0100;e\u171a\u171b\u623dq;\u62cd\u0176\u1722\u1726ee;\u62bded\u0100;g\u172c\u172d\u6305e\xbb\u172drk\u0100;t\u135c\u1737brk;\u63b6\u0100oy\u1701\u1741;\u4431quo;\u601e\u0280cmprt\u1753\u175b\u1761\u1764\u1768aus\u0100;e\u010a\u0109ptyv;\u69b0s\xe9\u170cno\xf5\u0113\u0180ahw\u176f\u1771\u1773;\u43b2;\u6136een;\u626cr;\uc000\ud835\udd1fg\u0380costuvw\u178d\u179d\u17b3\u17c1\u17d5\u17db\u17de\u0180aiu\u1794\u1796\u179a\xf0\u0760rc;\u65efp\xbb\u1371\u0180dpt\u17a4\u17a8\u17adot;\u6a00lus;\u6a01imes;\u6a02\u0271\u17b9\0\0\u17becup;\u6a06ar;\u6605riangle\u0100du\u17cd\u17d2own;\u65bdp;\u65b3plus;\u6a04e\xe5\u1444\xe5\u14adarow;\u690d\u0180ako\u17ed\u1826\u1835\u0100cn\u17f2\u1823k\u0180lst\u17fa\u05ab\u1802ozenge;\u69ebriangle\u0200;dlr\u1812\u1813\u1818\u181d\u65b4own;\u65beeft;\u65c2ight;\u65b8k;\u6423\u01b1\u182b\0\u1833\u01b2\u182f\0\u1831;\u6592;\u65914;\u6593ck;\u6588\u0100eo\u183e\u184d\u0100;q\u1843\u1846\uc000=\u20e5uiv;\uc000\u2261\u20e5t;\u6310\u0200ptwx\u1859\u185e\u1867\u186cf;\uc000\ud835\udd53\u0100;t\u13cb\u1863om\xbb\u13cctie;\u62c8\u0600DHUVbdhmptuv\u1885\u1896\u18aa\u18bb\u18d7\u18db\u18ec\u18ff\u1905\u190a\u1910\u1921\u0200LRlr\u188e\u1890\u1892\u1894;\u6557;\u6554;\u6556;\u6553\u0280;DUdu\u18a1\u18a2\u18a4\u18a6\u18a8\u6550;\u6566;\u6569;\u6564;\u6567\u0200LRlr\u18b3\u18b5\u18b7\u18b9;\u655d;\u655a;\u655c;\u6559\u0380;HLRhlr\u18ca\u18cb\u18cd\u18cf\u18d1\u18d3\u18d5\u6551;\u656c;\u6563;\u6560;\u656b;\u6562;\u655fox;\u69c9\u0200LRlr\u18e4\u18e6\u18e8\u18ea;\u6555;\u6552;\u6510;\u650c\u0280;DUdu\u06bd\u18f7\u18f9\u18fb\u18fd;\u6565;\u6568;\u652c;\u6534inus;\u629flus;\u629eimes;\u62a0\u0200LRlr\u1919\u191b\u191d\u191f;\u655b;\u6558;\u6518;\u6514\u0380;HLRhlr\u1930\u1931\u1933\u1935\u1937\u1939\u193b\u6502;\u656a;\u6561;\u655e;\u653c;\u6524;\u651c\u0100ev\u0123\u1942bar\u803b\xa6\u40a6\u0200ceio\u1951\u1956\u195a\u1960r;\uc000\ud835\udcb7mi;\u604fm\u0100;e\u171a\u171cl\u0180;bh\u1968\u1969\u196b\u405c;\u69c5sub;\u67c8\u016c\u1974\u197el\u0100;e\u1979\u197a\u6022t\xbb\u197ap\u0180;Ee\u012f\u1985\u1987;\u6aae\u0100;q\u06dc\u06db\u0ce1\u19a7\0\u19e8\u1a11\u1a15\u1a32\0\u1a37\u1a50\0\0\u1ab4\0\0\u1ac1\0\0\u1b21\u1b2e\u1b4d\u1b52\0\u1bfd\0\u1c0c\u0180cpr\u19ad\u19b2\u19ddute;\u4107\u0300;abcds\u19bf\u19c0\u19c4\u19ca\u19d5\u19d9\u6229nd;\u6a44rcup;\u6a49\u0100au\u19cf\u19d2p;\u6a4bp;\u6a47ot;\u6a40;\uc000\u2229\ufe00\u0100eo\u19e2\u19e5t;\u6041\xee\u0693\u0200aeiu\u19f0\u19fb\u1a01\u1a05\u01f0\u19f5\0\u19f8s;\u6a4don;\u410ddil\u803b\xe7\u40e7rc;\u4109ps\u0100;s\u1a0c\u1a0d\u6a4cm;\u6a50ot;\u410b\u0180dmn\u1a1b\u1a20\u1a26il\u80bb\xb8\u01adptyv;\u69b2t\u8100\xa2;e\u1a2d\u1a2e\u40a2r\xe4\u01b2r;\uc000\ud835\udd20\u0180cei\u1a3d\u1a40\u1a4dy;\u4447ck\u0100;m\u1a47\u1a48\u6713ark\xbb\u1a48;\u43c7r\u0380;Ecefms\u1a5f\u1a60\u1a62\u1a6b\u1aa4\u1aaa\u1aae\u65cb;\u69c3\u0180;el\u1a69\u1a6a\u1a6d\u42c6q;\u6257e\u0261\u1a74\0\0\u1a88rrow\u0100lr\u1a7c\u1a81eft;\u61baight;\u61bb\u0280RSacd\u1a92\u1a94\u1a96\u1a9a\u1a9f\xbb\u0f47;\u64c8st;\u629birc;\u629aash;\u629dnint;\u6a10id;\u6aefcir;\u69c2ubs\u0100;u\u1abb\u1abc\u6663it\xbb\u1abc\u02ec\u1ac7\u1ad4\u1afa\0\u1b0aon\u0100;e\u1acd\u1ace\u403a\u0100;q\xc7\xc6\u026d\u1ad9\0\0\u1ae2a\u0100;t\u1ade\u1adf\u402c;\u4040\u0180;fl\u1ae8\u1ae9\u1aeb\u6201\xee\u1160e\u0100mx\u1af1\u1af6ent\xbb\u1ae9e\xf3\u024d\u01e7\u1afe\0\u1b07\u0100;d\u12bb\u1b02ot;\u6a6dn\xf4\u0246\u0180fry\u1b10\u1b14\u1b17;\uc000\ud835\udd54o\xe4\u0254\u8100\xa9;s\u0155\u1b1dr;\u6117\u0100ao\u1b25\u1b29rr;\u61b5ss;\u6717\u0100cu\u1b32\u1b37r;\uc000\ud835\udcb8\u0100bp\u1b3c\u1b44\u0100;e\u1b41\u1b42\u6acf;\u6ad1\u0100;e\u1b49\u1b4a\u6ad0;\u6ad2dot;\u62ef\u0380delprvw\u1b60\u1b6c\u1b77\u1b82\u1bac\u1bd4\u1bf9arr\u0100lr\u1b68\u1b6a;\u6938;\u6935\u0270\u1b72\0\0\u1b75r;\u62dec;\u62dfarr\u0100;p\u1b7f\u1b80\u61b6;\u693d\u0300;bcdos\u1b8f\u1b90\u1b96\u1ba1\u1ba5\u1ba8\u622arcap;\u6a48\u0100au\u1b9b\u1b9ep;\u6a46p;\u6a4aot;\u628dr;\u6a45;\uc000\u222a\ufe00\u0200alrv\u1bb5\u1bbf\u1bde\u1be3rr\u0100;m\u1bbc\u1bbd\u61b7;\u693cy\u0180evw\u1bc7\u1bd4\u1bd8q\u0270\u1bce\0\0\u1bd2re\xe3\u1b73u\xe3\u1b75ee;\u62ceedge;\u62cfen\u803b\xa4\u40a4earrow\u0100lr\u1bee\u1bf3eft\xbb\u1b80ight\xbb\u1bbde\xe4\u1bdd\u0100ci\u1c01\u1c07onin\xf4\u01f7nt;\u6231lcty;\u632d\u0980AHabcdefhijlorstuwz\u1c38\u1c3b\u1c3f\u1c5d\u1c69\u1c75\u1c8a\u1c9e\u1cac\u1cb7\u1cfb\u1cff\u1d0d\u1d7b\u1d91\u1dab\u1dbb\u1dc6\u1dcdr\xf2\u0381ar;\u6965\u0200glrs\u1c48\u1c4d\u1c52\u1c54ger;\u6020eth;\u6138\xf2\u1133h\u0100;v\u1c5a\u1c5b\u6010\xbb\u090a\u016b\u1c61\u1c67arow;\u690fa\xe3\u0315\u0100ay\u1c6e\u1c73ron;\u410f;\u4434\u0180;ao\u0332\u1c7c\u1c84\u0100gr\u02bf\u1c81r;\u61catseq;\u6a77\u0180glm\u1c91\u1c94\u1c98\u803b\xb0\u40b0ta;\u43b4ptyv;\u69b1\u0100ir\u1ca3\u1ca8sht;\u697f;\uc000\ud835\udd21ar\u0100lr\u1cb3\u1cb5\xbb\u08dc\xbb\u101e\u0280aegsv\u1cc2\u0378\u1cd6\u1cdc\u1ce0m\u0180;os\u0326\u1cca\u1cd4nd\u0100;s\u0326\u1cd1uit;\u6666amma;\u43ddin;\u62f2\u0180;io\u1ce7\u1ce8\u1cf8\u40f7de\u8100\xf7;o\u1ce7\u1cf0ntimes;\u62c7n\xf8\u1cf7cy;\u4452c\u026f\u1d06\0\0\u1d0arn;\u631eop;\u630d\u0280lptuw\u1d18\u1d1d\u1d22\u1d49\u1d55lar;\u4024f;\uc000\ud835\udd55\u0280;emps\u030b\u1d2d\u1d37\u1d3d\u1d42q\u0100;d\u0352\u1d33ot;\u6251inus;\u6238lus;\u6214quare;\u62a1blebarwedg\xe5\xfan\u0180adh\u112e\u1d5d\u1d67ownarrow\xf3\u1c83arpoon\u0100lr\u1d72\u1d76ef\xf4\u1cb4igh\xf4\u1cb6\u0162\u1d7f\u1d85karo\xf7\u0f42\u026f\u1d8a\0\0\u1d8ern;\u631fop;\u630c\u0180cot\u1d98\u1da3\u1da6\u0100ry\u1d9d\u1da1;\uc000\ud835\udcb9;\u4455l;\u69f6rok;\u4111\u0100dr\u1db0\u1db4ot;\u62f1i\u0100;f\u1dba\u1816\u65bf\u0100ah\u1dc0\u1dc3r\xf2\u0429a\xf2\u0fa6angle;\u69a6\u0100ci\u1dd2\u1dd5y;\u445fgrarr;\u67ff\u0900Dacdefglmnopqrstux\u1e01\u1e09\u1e19\u1e38\u0578\u1e3c\u1e49\u1e61\u1e7e\u1ea5\u1eaf\u1ebd\u1ee1\u1f2a\u1f37\u1f44\u1f4e\u1f5a\u0100Do\u1e06\u1d34o\xf4\u1c89\u0100cs\u1e0e\u1e14ute\u803b\xe9\u40e9ter;\u6a6e\u0200aioy\u1e22\u1e27\u1e31\u1e36ron;\u411br\u0100;c\u1e2d\u1e2e\u6256\u803b\xea\u40ealon;\u6255;\u444dot;\u4117\u0100Dr\u1e41\u1e45ot;\u6252;\uc000\ud835\udd22\u0180;rs\u1e50\u1e51\u1e57\u6a9aave\u803b\xe8\u40e8\u0100;d\u1e5c\u1e5d\u6a96ot;\u6a98\u0200;ils\u1e6a\u1e6b\u1e72\u1e74\u6a99nters;\u63e7;\u6113\u0100;d\u1e79\u1e7a\u6a95ot;\u6a97\u0180aps\u1e85\u1e89\u1e97cr;\u4113ty\u0180;sv\u1e92\u1e93\u1e95\u6205et\xbb\u1e93p\u01001;\u1e9d\u1ea4\u0133\u1ea1\u1ea3;\u6004;\u6005\u6003\u0100gs\u1eaa\u1eac;\u414bp;\u6002\u0100gp\u1eb4\u1eb8on;\u4119f;\uc000\ud835\udd56\u0180als\u1ec4\u1ece\u1ed2r\u0100;s\u1eca\u1ecb\u62d5l;\u69e3us;\u6a71i\u0180;lv\u1eda\u1edb\u1edf\u43b5on\xbb\u1edb;\u43f5\u0200csuv\u1eea\u1ef3\u1f0b\u1f23\u0100io\u1eef\u1e31rc\xbb\u1e2e\u0269\u1ef9\0\0\u1efb\xed\u0548ant\u0100gl\u1f02\u1f06tr\xbb\u1e5dess\xbb\u1e7a\u0180aei\u1f12\u1f16\u1f1als;\u403dst;\u625fv\u0100;D\u0235\u1f20D;\u6a78parsl;\u69e5\u0100Da\u1f2f\u1f33ot;\u6253rr;\u6971\u0180cdi\u1f3e\u1f41\u1ef8r;\u612fo\xf4\u0352\u0100ah\u1f49\u1f4b;\u43b7\u803b\xf0\u40f0\u0100mr\u1f53\u1f57l\u803b\xeb\u40ebo;\u60ac\u0180cip\u1f61\u1f64\u1f67l;\u4021s\xf4\u056e\u0100eo\u1f6c\u1f74ctatio\xee\u0559nential\xe5\u0579\u09e1\u1f92\0\u1f9e\0\u1fa1\u1fa7\0\0\u1fc6\u1fcc\0\u1fd3\0\u1fe6\u1fea\u2000\0\u2008\u205allingdotse\xf1\u1e44y;\u4444male;\u6640\u0180ilr\u1fad\u1fb3\u1fc1lig;\u8000\ufb03\u0269\u1fb9\0\0\u1fbdg;\u8000\ufb00ig;\u8000\ufb04;\uc000\ud835\udd23lig;\u8000\ufb01lig;\uc000fj\u0180alt\u1fd9\u1fdc\u1fe1t;\u666dig;\u8000\ufb02ns;\u65b1of;\u4192\u01f0\u1fee\0\u1ff3f;\uc000\ud835\udd57\u0100ak\u05bf\u1ff7\u0100;v\u1ffc\u1ffd\u62d4;\u6ad9artint;\u6a0d\u0100ao\u200c\u2055\u0100cs\u2011\u2052\u03b1\u201a\u2030\u2038\u2045\u2048\0\u2050\u03b2\u2022\u2025\u2027\u202a\u202c\0\u202e\u803b\xbd\u40bd;\u6153\u803b\xbc\u40bc;\u6155;\u6159;\u615b\u01b3\u2034\0\u2036;\u6154;\u6156\u02b4\u203e\u2041\0\0\u2043\u803b\xbe\u40be;\u6157;\u615c5;\u6158\u01b6\u204c\0\u204e;\u615a;\u615d8;\u615el;\u6044wn;\u6322cr;\uc000\ud835\udcbb\u0880Eabcdefgijlnorstv\u2082\u2089\u209f\u20a5\u20b0\u20b4\u20f0\u20f5\u20fa\u20ff\u2103\u2112\u2138\u0317\u213e\u2152\u219e\u0100;l\u064d\u2087;\u6a8c\u0180cmp\u2090\u2095\u209dute;\u41f5ma\u0100;d\u209c\u1cda\u43b3;\u6a86reve;\u411f\u0100iy\u20aa\u20aerc;\u411d;\u4433ot;\u4121\u0200;lqs\u063e\u0642\u20bd\u20c9\u0180;qs\u063e\u064c\u20c4lan\xf4\u0665\u0200;cdl\u0665\u20d2\u20d5\u20e5c;\u6aa9ot\u0100;o\u20dc\u20dd\u6a80\u0100;l\u20e2\u20e3\u6a82;\u6a84\u0100;e\u20ea\u20ed\uc000\u22db\ufe00s;\u6a94r;\uc000\ud835\udd24\u0100;g\u0673\u061bmel;\u6137cy;\u4453\u0200;Eaj\u065a\u210c\u210e\u2110;\u6a92;\u6aa5;\u6aa4\u0200Eaes\u211b\u211d\u2129\u2134;\u6269p\u0100;p\u2123\u2124\u6a8arox\xbb\u2124\u0100;q\u212e\u212f\u6a88\u0100;q\u212e\u211bim;\u62e7pf;\uc000\ud835\udd58\u0100ci\u2143\u2146r;\u610am\u0180;el\u066b\u214e\u2150;\u6a8e;\u6a90\u8300>;cdlqr\u05ee\u2160\u216a\u216e\u2173\u2179\u0100ci\u2165\u2167;\u6aa7r;\u6a7aot;\u62d7Par;\u6995uest;\u6a7c\u0280adels\u2184\u216a\u2190\u0656\u219b\u01f0\u2189\0\u218epro\xf8\u209er;\u6978q\u0100lq\u063f\u2196les\xf3\u2088i\xed\u066b\u0100en\u21a3\u21adrtneqq;\uc000\u2269\ufe00\xc5\u21aa\u0500Aabcefkosy\u21c4\u21c7\u21f1\u21f5\u21fa\u2218\u221d\u222f\u2268\u227dr\xf2\u03a0\u0200ilmr\u21d0\u21d4\u21d7\u21dbrs\xf0\u1484f\xbb\u2024il\xf4\u06a9\u0100dr\u21e0\u21e4cy;\u444a\u0180;cw\u08f4\u21eb\u21efir;\u6948;\u61adar;\u610firc;\u4125\u0180alr\u2201\u220e\u2213rts\u0100;u\u2209\u220a\u6665it\xbb\u220alip;\u6026con;\u62b9r;\uc000\ud835\udd25s\u0100ew\u2223\u2229arow;\u6925arow;\u6926\u0280amopr\u223a\u223e\u2243\u225e\u2263rr;\u61fftht;\u623bk\u0100lr\u2249\u2253eftarrow;\u61a9ightarrow;\u61aaf;\uc000\ud835\udd59bar;\u6015\u0180clt\u226f\u2274\u2278r;\uc000\ud835\udcbdas\xe8\u21f4rok;\u4127\u0100bp\u2282\u2287ull;\u6043hen\xbb\u1c5b\u0ae1\u22a3\0\u22aa\0\u22b8\u22c5\u22ce\0\u22d5\u22f3\0\0\u22f8\u2322\u2367\u2362\u237f\0\u2386\u23aa\u23b4cute\u803b\xed\u40ed\u0180;iy\u0771\u22b0\u22b5rc\u803b\xee\u40ee;\u4438\u0100cx\u22bc\u22bfy;\u4435cl\u803b\xa1\u40a1\u0100fr\u039f\u22c9;\uc000\ud835\udd26rave\u803b\xec\u40ec\u0200;ino\u073e\u22dd\u22e9\u22ee\u0100in\u22e2\u22e6nt;\u6a0ct;\u622dfin;\u69dcta;\u6129lig;\u4133\u0180aop\u22fe\u231a\u231d\u0180cgt\u2305\u2308\u2317r;\u412b\u0180elp\u071f\u230f\u2313in\xe5\u078ear\xf4\u0720h;\u4131f;\u62b7ed;\u41b5\u0280;cfot\u04f4\u232c\u2331\u233d\u2341are;\u6105in\u0100;t\u2338\u2339\u621eie;\u69dddo\xf4\u2319\u0280;celp\u0757\u234c\u2350\u235b\u2361al;\u62ba\u0100gr\u2355\u2359er\xf3\u1563\xe3\u234darhk;\u6a17rod;\u6a3c\u0200cgpt\u236f\u2372\u2376\u237by;\u4451on;\u412ff;\uc000\ud835\udd5aa;\u43b9uest\u803b\xbf\u40bf\u0100ci\u238a\u238fr;\uc000\ud835\udcben\u0280;Edsv\u04f4\u239b\u239d\u23a1\u04f3;\u62f9ot;\u62f5\u0100;v\u23a6\u23a7\u62f4;\u62f3\u0100;i\u0777\u23aelde;\u4129\u01eb\u23b8\0\u23bccy;\u4456l\u803b\xef\u40ef\u0300cfmosu\u23cc\u23d7\u23dc\u23e1\u23e7\u23f5\u0100iy\u23d1\u23d5rc;\u4135;\u4439r;\uc000\ud835\udd27ath;\u4237pf;\uc000\ud835\udd5b\u01e3\u23ec\0\u23f1r;\uc000\ud835\udcbfrcy;\u4458kcy;\u4454\u0400acfghjos\u240b\u2416\u2422\u2427\u242d\u2431\u2435\u243bppa\u0100;v\u2413\u2414\u43ba;\u43f0\u0100ey\u241b\u2420dil;\u4137;\u443ar;\uc000\ud835\udd28reen;\u4138cy;\u4445cy;\u445cpf;\uc000\ud835\udd5ccr;\uc000\ud835\udcc0\u0b80ABEHabcdefghjlmnoprstuv\u2470\u2481\u2486\u248d\u2491\u250e\u253d\u255a\u2580\u264e\u265e\u2665\u2679\u267d\u269a\u26b2\u26d8\u275d\u2768\u278b\u27c0\u2801\u2812\u0180art\u2477\u247a\u247cr\xf2\u09c6\xf2\u0395ail;\u691barr;\u690e\u0100;g\u0994\u248b;\u6a8bar;\u6962\u0963\u24a5\0\u24aa\0\u24b1\0\0\0\0\0\u24b5\u24ba\0\u24c6\u24c8\u24cd\0\u24f9ute;\u413amptyv;\u69b4ra\xee\u084cbda;\u43bbg\u0180;dl\u088e\u24c1\u24c3;\u6991\xe5\u088e;\u6a85uo\u803b\xab\u40abr\u0400;bfhlpst\u0899\u24de\u24e6\u24e9\u24eb\u24ee\u24f1\u24f5\u0100;f\u089d\u24e3s;\u691fs;\u691d\xeb\u2252p;\u61abl;\u6939im;\u6973l;\u61a2\u0180;ae\u24ff\u2500\u2504\u6aabil;\u6919\u0100;s\u2509\u250a\u6aad;\uc000\u2aad\ufe00\u0180abr\u2515\u2519\u251drr;\u690crk;\u6772\u0100ak\u2522\u252cc\u0100ek\u2528\u252a;\u407b;\u405b\u0100es\u2531\u2533;\u698bl\u0100du\u2539\u253b;\u698f;\u698d\u0200aeuy\u2546\u254b\u2556\u2558ron;\u413e\u0100di\u2550\u2554il;\u413c\xec\u08b0\xe2\u2529;\u443b\u0200cqrs\u2563\u2566\u256d\u257da;\u6936uo\u0100;r\u0e19\u1746\u0100du\u2572\u2577har;\u6967shar;\u694bh;\u61b2\u0280;fgqs\u258b\u258c\u0989\u25f3\u25ff\u6264t\u0280ahlrt\u2598\u25a4\u25b7\u25c2\u25e8rrow\u0100;t\u0899\u25a1a\xe9\u24f6arpoon\u0100du\u25af\u25b4own\xbb\u045ap\xbb\u0966eftarrows;\u61c7ight\u0180ahs\u25cd\u25d6\u25derrow\u0100;s\u08f4\u08a7arpoon\xf3\u0f98quigarro\xf7\u21f0hreetimes;\u62cb\u0180;qs\u258b\u0993\u25falan\xf4\u09ac\u0280;cdgs\u09ac\u260a\u260d\u261d\u2628c;\u6aa8ot\u0100;o\u2614\u2615\u6a7f\u0100;r\u261a\u261b\u6a81;\u6a83\u0100;e\u2622\u2625\uc000\u22da\ufe00s;\u6a93\u0280adegs\u2633\u2639\u263d\u2649\u264bppro\xf8\u24c6ot;\u62d6q\u0100gq\u2643\u2645\xf4\u0989gt\xf2\u248c\xf4\u099bi\xed\u09b2\u0180ilr\u2655\u08e1\u265asht;\u697c;\uc000\ud835\udd29\u0100;E\u099c\u2663;\u6a91\u0161\u2669\u2676r\u0100du\u25b2\u266e\u0100;l\u0965\u2673;\u696alk;\u6584cy;\u4459\u0280;acht\u0a48\u2688\u268b\u2691\u2696r\xf2\u25c1orne\xf2\u1d08ard;\u696bri;\u65fa\u0100io\u269f\u26a4dot;\u4140ust\u0100;a\u26ac\u26ad\u63b0che\xbb\u26ad\u0200Eaes\u26bb\u26bd\u26c9\u26d4;\u6268p\u0100;p\u26c3\u26c4\u6a89rox\xbb\u26c4\u0100;q\u26ce\u26cf\u6a87\u0100;q\u26ce\u26bbim;\u62e6\u0400abnoptwz\u26e9\u26f4\u26f7\u271a\u272f\u2741\u2747\u2750\u0100nr\u26ee\u26f1g;\u67ecr;\u61fdr\xeb\u08c1g\u0180lmr\u26ff\u270d\u2714eft\u0100ar\u09e6\u2707ight\xe1\u09f2apsto;\u67fcight\xe1\u09fdparrow\u0100lr\u2725\u2729ef\xf4\u24edight;\u61ac\u0180afl\u2736\u2739\u273dr;\u6985;\uc000\ud835\udd5dus;\u6a2dimes;\u6a34\u0161\u274b\u274fst;\u6217\xe1\u134e\u0180;ef\u2757\u2758\u1800\u65cange\xbb\u2758ar\u0100;l\u2764\u2765\u4028t;\u6993\u0280achmt\u2773\u2776\u277c\u2785\u2787r\xf2\u08a8orne\xf2\u1d8car\u0100;d\u0f98\u2783;\u696d;\u600eri;\u62bf\u0300achiqt\u2798\u279d\u0a40\u27a2\u27ae\u27bbquo;\u6039r;\uc000\ud835\udcc1m\u0180;eg\u09b2\u27aa\u27ac;\u6a8d;\u6a8f\u0100bu\u252a\u27b3o\u0100;r\u0e1f\u27b9;\u601arok;\u4142\u8400<;cdhilqr\u082b\u27d2\u2639\u27dc\u27e0\u27e5\u27ea\u27f0\u0100ci\u27d7\u27d9;\u6aa6r;\u6a79re\xe5\u25f2mes;\u62c9arr;\u6976uest;\u6a7b\u0100Pi\u27f5\u27f9ar;\u6996\u0180;ef\u2800\u092d\u181b\u65c3r\u0100du\u2807\u280dshar;\u694ahar;\u6966\u0100en\u2817\u2821rtneqq;\uc000\u2268\ufe00\xc5\u281e\u0700Dacdefhilnopsu\u2840\u2845\u2882\u288e\u2893\u28a0\u28a5\u28a8\u28da\u28e2\u28e4\u0a83\u28f3\u2902Dot;\u623a\u0200clpr\u284e\u2852\u2863\u287dr\u803b\xaf\u40af\u0100et\u2857\u2859;\u6642\u0100;e\u285e\u285f\u6720se\xbb\u285f\u0100;s\u103b\u2868to\u0200;dlu\u103b\u2873\u2877\u287bow\xee\u048cef\xf4\u090f\xf0\u13d1ker;\u65ae\u0100oy\u2887\u288cmma;\u6a29;\u443cash;\u6014asuredangle\xbb\u1626r;\uc000\ud835\udd2ao;\u6127\u0180cdn\u28af\u28b4\u28c9ro\u803b\xb5\u40b5\u0200;acd\u1464\u28bd\u28c0\u28c4s\xf4\u16a7ir;\u6af0ot\u80bb\xb7\u01b5us\u0180;bd\u28d2\u1903\u28d3\u6212\u0100;u\u1d3c\u28d8;\u6a2a\u0163\u28de\u28e1p;\u6adb\xf2\u2212\xf0\u0a81\u0100dp\u28e9\u28eeels;\u62a7f;\uc000\ud835\udd5e\u0100ct\u28f8\u28fdr;\uc000\ud835\udcc2pos\xbb\u159d\u0180;lm\u2909\u290a\u290d\u43bctimap;\u62b8\u0c00GLRVabcdefghijlmoprstuvw\u2942\u2953\u297e\u2989\u2998\u29da\u29e9\u2a15\u2a1a\u2a58\u2a5d\u2a83\u2a95\u2aa4\u2aa8\u2b04\u2b07\u2b44\u2b7f\u2bae\u2c34\u2c67\u2c7c\u2ce9\u0100gt\u2947\u294b;\uc000\u22d9\u0338\u0100;v\u2950\u0bcf\uc000\u226b\u20d2\u0180elt\u295a\u2972\u2976ft\u0100ar\u2961\u2967rrow;\u61cdightarrow;\u61ce;\uc000\u22d8\u0338\u0100;v\u297b\u0c47\uc000\u226a\u20d2ightarrow;\u61cf\u0100Dd\u298e\u2993ash;\u62afash;\u62ae\u0280bcnpt\u29a3\u29a7\u29ac\u29b1\u29ccla\xbb\u02deute;\u4144g;\uc000\u2220\u20d2\u0280;Eiop\u0d84\u29bc\u29c0\u29c5\u29c8;\uc000\u2a70\u0338d;\uc000\u224b\u0338s;\u4149ro\xf8\u0d84ur\u0100;a\u29d3\u29d4\u666el\u0100;s\u29d3\u0b38\u01f3\u29df\0\u29e3p\u80bb\xa0\u0b37mp\u0100;e\u0bf9\u0c00\u0280aeouy\u29f4\u29fe\u2a03\u2a10\u2a13\u01f0\u29f9\0\u29fb;\u6a43on;\u4148dil;\u4146ng\u0100;d\u0d7e\u2a0aot;\uc000\u2a6d\u0338p;\u6a42;\u443dash;\u6013\u0380;Aadqsx\u0b92\u2a29\u2a2d\u2a3b\u2a41\u2a45\u2a50rr;\u61d7r\u0100hr\u2a33\u2a36k;\u6924\u0100;o\u13f2\u13f0ot;\uc000\u2250\u0338ui\xf6\u0b63\u0100ei\u2a4a\u2a4ear;\u6928\xed\u0b98ist\u0100;s\u0ba0\u0b9fr;\uc000\ud835\udd2b\u0200Eest\u0bc5\u2a66\u2a79\u2a7c\u0180;qs\u0bbc\u2a6d\u0be1\u0180;qs\u0bbc\u0bc5\u2a74lan\xf4\u0be2i\xed\u0bea\u0100;r\u0bb6\u2a81\xbb\u0bb7\u0180Aap\u2a8a\u2a8d\u2a91r\xf2\u2971rr;\u61aear;\u6af2\u0180;sv\u0f8d\u2a9c\u0f8c\u0100;d\u2aa1\u2aa2\u62fc;\u62facy;\u445a\u0380AEadest\u2ab7\u2aba\u2abe\u2ac2\u2ac5\u2af6\u2af9r\xf2\u2966;\uc000\u2266\u0338rr;\u619ar;\u6025\u0200;fqs\u0c3b\u2ace\u2ae3\u2aeft\u0100ar\u2ad4\u2ad9rro\xf7\u2ac1ightarro\xf7\u2a90\u0180;qs\u0c3b\u2aba\u2aealan\xf4\u0c55\u0100;s\u0c55\u2af4\xbb\u0c36i\xed\u0c5d\u0100;r\u0c35\u2afei\u0100;e\u0c1a\u0c25i\xe4\u0d90\u0100pt\u2b0c\u2b11f;\uc000\ud835\udd5f\u8180\xac;in\u2b19\u2b1a\u2b36\u40acn\u0200;Edv\u0b89\u2b24\u2b28\u2b2e;\uc000\u22f9\u0338ot;\uc000\u22f5\u0338\u01e1\u0b89\u2b33\u2b35;\u62f7;\u62f6i\u0100;v\u0cb8\u2b3c\u01e1\u0cb8\u2b41\u2b43;\u62fe;\u62fd\u0180aor\u2b4b\u2b63\u2b69r\u0200;ast\u0b7b\u2b55\u2b5a\u2b5flle\xec\u0b7bl;\uc000\u2afd\u20e5;\uc000\u2202\u0338lint;\u6a14\u0180;ce\u0c92\u2b70\u2b73u\xe5\u0ca5\u0100;c\u0c98\u2b78\u0100;e\u0c92\u2b7d\xf1\u0c98\u0200Aait\u2b88\u2b8b\u2b9d\u2ba7r\xf2\u2988rr\u0180;cw\u2b94\u2b95\u2b99\u619b;\uc000\u2933\u0338;\uc000\u219d\u0338ghtarrow\xbb\u2b95ri\u0100;e\u0ccb\u0cd6\u0380chimpqu\u2bbd\u2bcd\u2bd9\u2b04\u0b78\u2be4\u2bef\u0200;cer\u0d32\u2bc6\u0d37\u2bc9u\xe5\u0d45;\uc000\ud835\udcc3ort\u026d\u2b05\0\0\u2bd6ar\xe1\u2b56m\u0100;e\u0d6e\u2bdf\u0100;q\u0d74\u0d73su\u0100bp\u2beb\u2bed\xe5\u0cf8\xe5\u0d0b\u0180bcp\u2bf6\u2c11\u2c19\u0200;Ees\u2bff\u2c00\u0d22\u2c04\u6284;\uc000\u2ac5\u0338et\u0100;e\u0d1b\u2c0bq\u0100;q\u0d23\u2c00c\u0100;e\u0d32\u2c17\xf1\u0d38\u0200;Ees\u2c22\u2c23\u0d5f\u2c27\u6285;\uc000\u2ac6\u0338et\u0100;e\u0d58\u2c2eq\u0100;q\u0d60\u2c23\u0200gilr\u2c3d\u2c3f\u2c45\u2c47\xec\u0bd7lde\u803b\xf1\u40f1\xe7\u0c43iangle\u0100lr\u2c52\u2c5ceft\u0100;e\u0c1a\u2c5a\xf1\u0c26ight\u0100;e\u0ccb\u2c65\xf1\u0cd7\u0100;m\u2c6c\u2c6d\u43bd\u0180;es\u2c74\u2c75\u2c79\u4023ro;\u6116p;\u6007\u0480DHadgilrs\u2c8f\u2c94\u2c99\u2c9e\u2ca3\u2cb0\u2cb6\u2cd3\u2ce3ash;\u62adarr;\u6904p;\uc000\u224d\u20d2ash;\u62ac\u0100et\u2ca8\u2cac;\uc000\u2265\u20d2;\uc000>\u20d2nfin;\u69de\u0180Aet\u2cbd\u2cc1\u2cc5rr;\u6902;\uc000\u2264\u20d2\u0100;r\u2cca\u2ccd\uc000<\u20d2ie;\uc000\u22b4\u20d2\u0100At\u2cd8\u2cdcrr;\u6903rie;\uc000\u22b5\u20d2im;\uc000\u223c\u20d2\u0180Aan\u2cf0\u2cf4\u2d02rr;\u61d6r\u0100hr\u2cfa\u2cfdk;\u6923\u0100;o\u13e7\u13e5ear;\u6927\u1253\u1a95\0\0\0\0\0\0\0\0\0\0\0\0\0\u2d2d\0\u2d38\u2d48\u2d60\u2d65\u2d72\u2d84\u1b07\0\0\u2d8d\u2dab\0\u2dc8\u2dce\0\u2ddc\u2e19\u2e2b\u2e3e\u2e43\u0100cs\u2d31\u1a97ute\u803b\xf3\u40f3\u0100iy\u2d3c\u2d45r\u0100;c\u1a9e\u2d42\u803b\xf4\u40f4;\u443e\u0280abios\u1aa0\u2d52\u2d57\u01c8\u2d5alac;\u4151v;\u6a38old;\u69bclig;\u4153\u0100cr\u2d69\u2d6dir;\u69bf;\uc000\ud835\udd2c\u036f\u2d79\0\0\u2d7c\0\u2d82n;\u42dbave\u803b\xf2\u40f2;\u69c1\u0100bm\u2d88\u0df4ar;\u69b5\u0200acit\u2d95\u2d98\u2da5\u2da8r\xf2\u1a80\u0100ir\u2d9d\u2da0r;\u69beoss;\u69bbn\xe5\u0e52;\u69c0\u0180aei\u2db1\u2db5\u2db9cr;\u414dga;\u43c9\u0180cdn\u2dc0\u2dc5\u01cdron;\u43bf;\u69b6pf;\uc000\ud835\udd60\u0180ael\u2dd4\u2dd7\u01d2r;\u69b7rp;\u69b9\u0380;adiosv\u2dea\u2deb\u2dee\u2e08\u2e0d\u2e10\u2e16\u6228r\xf2\u1a86\u0200;efm\u2df7\u2df8\u2e02\u2e05\u6a5dr\u0100;o\u2dfe\u2dff\u6134f\xbb\u2dff\u803b\xaa\u40aa\u803b\xba\u40bagof;\u62b6r;\u6a56lope;\u6a57;\u6a5b\u0180clo\u2e1f\u2e21\u2e27\xf2\u2e01ash\u803b\xf8\u40f8l;\u6298i\u016c\u2e2f\u2e34de\u803b\xf5\u40f5es\u0100;a\u01db\u2e3as;\u6a36ml\u803b\xf6\u40f6bar;\u633d\u0ae1\u2e5e\0\u2e7d\0\u2e80\u2e9d\0\u2ea2\u2eb9\0\0\u2ecb\u0e9c\0\u2f13\0\0\u2f2b\u2fbc\0\u2fc8r\u0200;ast\u0403\u2e67\u2e72\u0e85\u8100\xb6;l\u2e6d\u2e6e\u40b6le\xec\u0403\u0269\u2e78\0\0\u2e7bm;\u6af3;\u6afdy;\u443fr\u0280cimpt\u2e8b\u2e8f\u2e93\u1865\u2e97nt;\u4025od;\u402eil;\u6030enk;\u6031r;\uc000\ud835\udd2d\u0180imo\u2ea8\u2eb0\u2eb4\u0100;v\u2ead\u2eae\u43c6;\u43d5ma\xf4\u0a76ne;\u660e\u0180;tv\u2ebf\u2ec0\u2ec8\u43c0chfork\xbb\u1ffd;\u43d6\u0100au\u2ecf\u2edfn\u0100ck\u2ed5\u2eddk\u0100;h\u21f4\u2edb;\u610e\xf6\u21f4s\u0480;abcdemst\u2ef3\u2ef4\u1908\u2ef9\u2efd\u2f04\u2f06\u2f0a\u2f0e\u402bcir;\u6a23ir;\u6a22\u0100ou\u1d40\u2f02;\u6a25;\u6a72n\u80bb\xb1\u0e9dim;\u6a26wo;\u6a27\u0180ipu\u2f19\u2f20\u2f25ntint;\u6a15f;\uc000\ud835\udd61nd\u803b\xa3\u40a3\u0500;Eaceinosu\u0ec8\u2f3f\u2f41\u2f44\u2f47\u2f81\u2f89\u2f92\u2f7e\u2fb6;\u6ab3p;\u6ab7u\xe5\u0ed9\u0100;c\u0ece\u2f4c\u0300;acens\u0ec8\u2f59\u2f5f\u2f66\u2f68\u2f7eppro\xf8\u2f43urlye\xf1\u0ed9\xf1\u0ece\u0180aes\u2f6f\u2f76\u2f7approx;\u6ab9qq;\u6ab5im;\u62e8i\xed\u0edfme\u0100;s\u2f88\u0eae\u6032\u0180Eas\u2f78\u2f90\u2f7a\xf0\u2f75\u0180dfp\u0eec\u2f99\u2faf\u0180als\u2fa0\u2fa5\u2faalar;\u632eine;\u6312urf;\u6313\u0100;t\u0efb\u2fb4\xef\u0efbrel;\u62b0\u0100ci\u2fc0\u2fc5r;\uc000\ud835\udcc5;\u43c8ncsp;\u6008\u0300fiopsu\u2fda\u22e2\u2fdf\u2fe5\u2feb\u2ff1r;\uc000\ud835\udd2epf;\uc000\ud835\udd62rime;\u6057cr;\uc000\ud835\udcc6\u0180aeo\u2ff8\u3009\u3013t\u0100ei\u2ffe\u3005rnion\xf3\u06b0nt;\u6a16st\u0100;e\u3010\u3011\u403f\xf1\u1f19\xf4\u0f14\u0a80ABHabcdefhilmnoprstux\u3040\u3051\u3055\u3059\u30e0\u310e\u312b\u3147\u3162\u3172\u318e\u3206\u3215\u3224\u3229\u3258\u326e\u3272\u3290\u32b0\u32b7\u0180art\u3047\u304a\u304cr\xf2\u10b3\xf2\u03ddail;\u691car\xf2\u1c65ar;\u6964\u0380cdenqrt\u3068\u3075\u3078\u307f\u308f\u3094\u30cc\u0100eu\u306d\u3071;\uc000\u223d\u0331te;\u4155i\xe3\u116emptyv;\u69b3g\u0200;del\u0fd1\u3089\u308b\u308d;\u6992;\u69a5\xe5\u0fd1uo\u803b\xbb\u40bbr\u0580;abcfhlpstw\u0fdc\u30ac\u30af\u30b7\u30b9\u30bc\u30be\u30c0\u30c3\u30c7\u30cap;\u6975\u0100;f\u0fe0\u30b4s;\u6920;\u6933s;\u691e\xeb\u225d\xf0\u272el;\u6945im;\u6974l;\u61a3;\u619d\u0100ai\u30d1\u30d5il;\u691ao\u0100;n\u30db\u30dc\u6236al\xf3\u0f1e\u0180abr\u30e7\u30ea\u30eer\xf2\u17e5rk;\u6773\u0100ak\u30f3\u30fdc\u0100ek\u30f9\u30fb;\u407d;\u405d\u0100es\u3102\u3104;\u698cl\u0100du\u310a\u310c;\u698e;\u6990\u0200aeuy\u3117\u311c\u3127\u3129ron;\u4159\u0100di\u3121\u3125il;\u4157\xec\u0ff2\xe2\u30fa;\u4440\u0200clqs\u3134\u3137\u313d\u3144a;\u6937dhar;\u6969uo\u0100;r\u020e\u020dh;\u61b3\u0180acg\u314e\u315f\u0f44l\u0200;ips\u0f78\u3158\u315b\u109cn\xe5\u10bbar\xf4\u0fa9t;\u65ad\u0180ilr\u3169\u1023\u316esht;\u697d;\uc000\ud835\udd2f\u0100ao\u3177\u3186r\u0100du\u317d\u317f\xbb\u047b\u0100;l\u1091\u3184;\u696c\u0100;v\u318b\u318c\u43c1;\u43f1\u0180gns\u3195\u31f9\u31fcht\u0300ahlrst\u31a4\u31b0\u31c2\u31d8\u31e4\u31eerrow\u0100;t\u0fdc\u31ada\xe9\u30c8arpoon\u0100du\u31bb\u31bfow\xee\u317ep\xbb\u1092eft\u0100ah\u31ca\u31d0rrow\xf3\u0feaarpoon\xf3\u0551ightarrows;\u61c9quigarro\xf7\u30cbhreetimes;\u62ccg;\u42daingdotse\xf1\u1f32\u0180ahm\u320d\u3210\u3213r\xf2\u0feaa\xf2\u0551;\u600foust\u0100;a\u321e\u321f\u63b1che\xbb\u321fmid;\u6aee\u0200abpt\u3232\u323d\u3240\u3252\u0100nr\u3237\u323ag;\u67edr;\u61fer\xeb\u1003\u0180afl\u3247\u324a\u324er;\u6986;\uc000\ud835\udd63us;\u6a2eimes;\u6a35\u0100ap\u325d\u3267r\u0100;g\u3263\u3264\u4029t;\u6994olint;\u6a12ar\xf2\u31e3\u0200achq\u327b\u3280\u10bc\u3285quo;\u603ar;\uc000\ud835\udcc7\u0100bu\u30fb\u328ao\u0100;r\u0214\u0213\u0180hir\u3297\u329b\u32a0re\xe5\u31f8mes;\u62cai\u0200;efl\u32aa\u1059\u1821\u32ab\u65b9tri;\u69celuhar;\u6968;\u611e\u0d61\u32d5\u32db\u32df\u332c\u3338\u3371\0\u337a\u33a4\0\0\u33ec\u33f0\0\u3428\u3448\u345a\u34ad\u34b1\u34ca\u34f1\0\u3616\0\0\u3633cute;\u415bqu\xef\u27ba\u0500;Eaceinpsy\u11ed\u32f3\u32f5\u32ff\u3302\u330b\u330f\u331f\u3326\u3329;\u6ab4\u01f0\u32fa\0\u32fc;\u6ab8on;\u4161u\xe5\u11fe\u0100;d\u11f3\u3307il;\u415frc;\u415d\u0180Eas\u3316\u3318\u331b;\u6ab6p;\u6abaim;\u62e9olint;\u6a13i\xed\u1204;\u4441ot\u0180;be\u3334\u1d47\u3335\u62c5;\u6a66\u0380Aacmstx\u3346\u334a\u3357\u335b\u335e\u3363\u336drr;\u61d8r\u0100hr\u3350\u3352\xeb\u2228\u0100;o\u0a36\u0a34t\u803b\xa7\u40a7i;\u403bwar;\u6929m\u0100in\u3369\xf0nu\xf3\xf1t;\u6736r\u0100;o\u3376\u2055\uc000\ud835\udd30\u0200acoy\u3382\u3386\u3391\u33a0rp;\u666f\u0100hy\u338b\u338fcy;\u4449;\u4448rt\u026d\u3399\0\0\u339ci\xe4\u1464ara\xec\u2e6f\u803b\xad\u40ad\u0100gm\u33a8\u33b4ma\u0180;fv\u33b1\u33b2\u33b2\u43c3;\u43c2\u0400;deglnpr\u12ab\u33c5\u33c9\u33ce\u33d6\u33de\u33e1\u33e6ot;\u6a6a\u0100;q\u12b1\u12b0\u0100;E\u33d3\u33d4\u6a9e;\u6aa0\u0100;E\u33db\u33dc\u6a9d;\u6a9fe;\u6246lus;\u6a24arr;\u6972ar\xf2\u113d\u0200aeit\u33f8\u3408\u340f\u3417\u0100ls\u33fd\u3404lsetm\xe9\u336ahp;\u6a33parsl;\u69e4\u0100dl\u1463\u3414e;\u6323\u0100;e\u341c\u341d\u6aaa\u0100;s\u3422\u3423\u6aac;\uc000\u2aac\ufe00\u0180flp\u342e\u3433\u3442tcy;\u444c\u0100;b\u3438\u3439\u402f\u0100;a\u343e\u343f\u69c4r;\u633ff;\uc000\ud835\udd64a\u0100dr\u344d\u0402es\u0100;u\u3454\u3455\u6660it\xbb\u3455\u0180csu\u3460\u3479\u349f\u0100au\u3465\u346fp\u0100;s\u1188\u346b;\uc000\u2293\ufe00p\u0100;s\u11b4\u3475;\uc000\u2294\ufe00u\u0100bp\u347f\u348f\u0180;es\u1197\u119c\u3486et\u0100;e\u1197\u348d\xf1\u119d\u0180;es\u11a8\u11ad\u3496et\u0100;e\u11a8\u349d\xf1\u11ae\u0180;af\u117b\u34a6\u05b0r\u0165\u34ab\u05b1\xbb\u117car\xf2\u1148\u0200cemt\u34b9\u34be\u34c2\u34c5r;\uc000\ud835\udcc8tm\xee\xf1i\xec\u3415ar\xe6\u11be\u0100ar\u34ce\u34d5r\u0100;f\u34d4\u17bf\u6606\u0100an\u34da\u34edight\u0100ep\u34e3\u34eapsilo\xee\u1ee0h\xe9\u2eafs\xbb\u2852\u0280bcmnp\u34fb\u355e\u1209\u358b\u358e\u0480;Edemnprs\u350e\u350f\u3511\u3515\u351e\u3523\u352c\u3531\u3536\u6282;\u6ac5ot;\u6abd\u0100;d\u11da\u351aot;\u6ac3ult;\u6ac1\u0100Ee\u3528\u352a;\u6acb;\u628alus;\u6abfarr;\u6979\u0180eiu\u353d\u3552\u3555t\u0180;en\u350e\u3545\u354bq\u0100;q\u11da\u350feq\u0100;q\u352b\u3528m;\u6ac7\u0100bp\u355a\u355c;\u6ad5;\u6ad3c\u0300;acens\u11ed\u356c\u3572\u3579\u357b\u3326ppro\xf8\u32faurlye\xf1\u11fe\xf1\u11f3\u0180aes\u3582\u3588\u331bppro\xf8\u331aq\xf1\u3317g;\u666a\u0680123;Edehlmnps\u35a9\u35ac\u35af\u121c\u35b2\u35b4\u35c0\u35c9\u35d5\u35da\u35df\u35e8\u35ed\u803b\xb9\u40b9\u803b\xb2\u40b2\u803b\xb3\u40b3;\u6ac6\u0100os\u35b9\u35bct;\u6abeub;\u6ad8\u0100;d\u1222\u35c5ot;\u6ac4s\u0100ou\u35cf\u35d2l;\u67c9b;\u6ad7arr;\u697bult;\u6ac2\u0100Ee\u35e4\u35e6;\u6acc;\u628blus;\u6ac0\u0180eiu\u35f4\u3609\u360ct\u0180;en\u121c\u35fc\u3602q\u0100;q\u1222\u35b2eq\u0100;q\u35e7\u35e4m;\u6ac8\u0100bp\u3611\u3613;\u6ad4;\u6ad6\u0180Aan\u361c\u3620\u362drr;\u61d9r\u0100hr\u3626\u3628\xeb\u222e\u0100;o\u0a2b\u0a29war;\u692alig\u803b\xdf\u40df\u0be1\u3651\u365d\u3660\u12ce\u3673\u3679\0\u367e\u36c2\0\0\0\0\0\u36db\u3703\0\u3709\u376c\0\0\0\u3787\u0272\u3656\0\0\u365bget;\u6316;\u43c4r\xeb\u0e5f\u0180aey\u3666\u366b\u3670ron;\u4165dil;\u4163;\u4442lrec;\u6315r;\uc000\ud835\udd31\u0200eiko\u3686\u369d\u36b5\u36bc\u01f2\u368b\0\u3691e\u01004f\u1284\u1281a\u0180;sv\u3698\u3699\u369b\u43b8ym;\u43d1\u0100cn\u36a2\u36b2k\u0100as\u36a8\u36aeppro\xf8\u12c1im\xbb\u12acs\xf0\u129e\u0100as\u36ba\u36ae\xf0\u12c1rn\u803b\xfe\u40fe\u01ec\u031f\u36c6\u22e7es\u8180\xd7;bd\u36cf\u36d0\u36d8\u40d7\u0100;a\u190f\u36d5r;\u6a31;\u6a30\u0180eps\u36e1\u36e3\u3700\xe1\u2a4d\u0200;bcf\u0486\u36ec\u36f0\u36f4ot;\u6336ir;\u6af1\u0100;o\u36f9\u36fc\uc000\ud835\udd65rk;\u6ada\xe1\u3362rime;\u6034\u0180aip\u370f\u3712\u3764d\xe5\u1248\u0380adempst\u3721\u374d\u3740\u3751\u3757\u375c\u375fngle\u0280;dlqr\u3730\u3731\u3736\u3740\u3742\u65b5own\xbb\u1dbbeft\u0100;e\u2800\u373e\xf1\u092e;\u625cight\u0100;e\u32aa\u374b\xf1\u105aot;\u65ecinus;\u6a3alus;\u6a39b;\u69cdime;\u6a3bezium;\u63e2\u0180cht\u3772\u377d\u3781\u0100ry\u3777\u377b;\uc000\ud835\udcc9;\u4446cy;\u445brok;\u4167\u0100io\u378b\u378ex\xf4\u1777head\u0100lr\u3797\u37a0eftarro\xf7\u084fightarrow\xbb\u0f5d\u0900AHabcdfghlmoprstuw\u37d0\u37d3\u37d7\u37e4\u37f0\u37fc\u380e\u381c\u3823\u3834\u3851\u385d\u386b\u38a9\u38cc\u38d2\u38ea\u38f6r\xf2\u03edar;\u6963\u0100cr\u37dc\u37e2ute\u803b\xfa\u40fa\xf2\u1150r\u01e3\u37ea\0\u37edy;\u445eve;\u416d\u0100iy\u37f5\u37farc\u803b\xfb\u40fb;\u4443\u0180abh\u3803\u3806\u380br\xf2\u13adlac;\u4171a\xf2\u13c3\u0100ir\u3813\u3818sht;\u697e;\uc000\ud835\udd32rave\u803b\xf9\u40f9\u0161\u3827\u3831r\u0100lr\u382c\u382e\xbb\u0957\xbb\u1083lk;\u6580\u0100ct\u3839\u384d\u026f\u383f\0\0\u384arn\u0100;e\u3845\u3846\u631cr\xbb\u3846op;\u630fri;\u65f8\u0100al\u3856\u385acr;\u416b\u80bb\xa8\u0349\u0100gp\u3862\u3866on;\u4173f;\uc000\ud835\udd66\u0300adhlsu\u114b\u3878\u387d\u1372\u3891\u38a0own\xe1\u13b3arpoon\u0100lr\u3888\u388cef\xf4\u382digh\xf4\u382fi\u0180;hl\u3899\u389a\u389c\u43c5\xbb\u13faon\xbb\u389aparrows;\u61c8\u0180cit\u38b0\u38c4\u38c8\u026f\u38b6\0\0\u38c1rn\u0100;e\u38bc\u38bd\u631dr\xbb\u38bdop;\u630eng;\u416fri;\u65f9cr;\uc000\ud835\udcca\u0180dir\u38d9\u38dd\u38e2ot;\u62f0lde;\u4169i\u0100;f\u3730\u38e8\xbb\u1813\u0100am\u38ef\u38f2r\xf2\u38a8l\u803b\xfc\u40fcangle;\u69a7\u0780ABDacdeflnoprsz\u391c\u391f\u3929\u392d\u39b5\u39b8\u39bd\u39df\u39e4\u39e8\u39f3\u39f9\u39fd\u3a01\u3a20r\xf2\u03f7ar\u0100;v\u3926\u3927\u6ae8;\u6ae9as\xe8\u03e1\u0100nr\u3932\u3937grt;\u699c\u0380eknprst\u34e3\u3946\u394b\u3952\u395d\u3964\u3996app\xe1\u2415othin\xe7\u1e96\u0180hir\u34eb\u2ec8\u3959op\xf4\u2fb5\u0100;h\u13b7\u3962\xef\u318d\u0100iu\u3969\u396dgm\xe1\u33b3\u0100bp\u3972\u3984setneq\u0100;q\u397d\u3980\uc000\u228a\ufe00;\uc000\u2acb\ufe00setneq\u0100;q\u398f\u3992\uc000\u228b\ufe00;\uc000\u2acc\ufe00\u0100hr\u399b\u399fet\xe1\u369ciangle\u0100lr\u39aa\u39afeft\xbb\u0925ight\xbb\u1051y;\u4432ash\xbb\u1036\u0180elr\u39c4\u39d2\u39d7\u0180;be\u2dea\u39cb\u39cfar;\u62bbq;\u625alip;\u62ee\u0100bt\u39dc\u1468a\xf2\u1469r;\uc000\ud835\udd33tr\xe9\u39aesu\u0100bp\u39ef\u39f1\xbb\u0d1c\xbb\u0d59pf;\uc000\ud835\udd67ro\xf0\u0efbtr\xe9\u39b4\u0100cu\u3a06\u3a0br;\uc000\ud835\udccb\u0100bp\u3a10\u3a18n\u0100Ee\u3980\u3a16\xbb\u397en\u0100Ee\u3992\u3a1e\xbb\u3990igzag;\u699a\u0380cefoprs\u3a36\u3a3b\u3a56\u3a5b\u3a54\u3a61\u3a6airc;\u4175\u0100di\u3a40\u3a51\u0100bg\u3a45\u3a49ar;\u6a5fe\u0100;q\u15fa\u3a4f;\u6259erp;\u6118r;\uc000\ud835\udd34pf;\uc000\ud835\udd68\u0100;e\u1479\u3a66at\xe8\u1479cr;\uc000\ud835\udccc\u0ae3\u178e\u3a87\0\u3a8b\0\u3a90\u3a9b\0\0\u3a9d\u3aa8\u3aab\u3aaf\0\0\u3ac3\u3ace\0\u3ad8\u17dc\u17dftr\xe9\u17d1r;\uc000\ud835\udd35\u0100Aa\u3a94\u3a97r\xf2\u03c3r\xf2\u09f6;\u43be\u0100Aa\u3aa1\u3aa4r\xf2\u03b8r\xf2\u09eba\xf0\u2713is;\u62fb\u0180dpt\u17a4\u3ab5\u3abe\u0100fl\u3aba\u17a9;\uc000\ud835\udd69im\xe5\u17b2\u0100Aa\u3ac7\u3acar\xf2\u03cer\xf2\u0a01\u0100cq\u3ad2\u17b8r;\uc000\ud835\udccd\u0100pt\u17d6\u3adcr\xe9\u17d4\u0400acefiosu\u3af0\u3afd\u3b08\u3b0c\u3b11\u3b15\u3b1b\u3b21c\u0100uy\u3af6\u3afbte\u803b\xfd\u40fd;\u444f\u0100iy\u3b02\u3b06rc;\u4177;\u444bn\u803b\xa5\u40a5r;\uc000\ud835\udd36cy;\u4457pf;\uc000\ud835\udd6acr;\uc000\ud835\udcce\u0100cm\u3b26\u3b29y;\u444el\u803b\xff\u40ff\u0500acdefhiosw\u3b42\u3b48\u3b54\u3b58\u3b64\u3b69\u3b6d\u3b74\u3b7a\u3b80cute;\u417a\u0100ay\u3b4d\u3b52ron;\u417e;\u4437ot;\u417c\u0100et\u3b5d\u3b61tr\xe6\u155fa;\u43b6r;\uc000\ud835\udd37cy;\u4436grarr;\u61ddpf;\uc000\ud835\udd6bcr;\uc000\ud835\udccf\u0100jn\u3b85\u3b87;\u600dj;\u600c"
    .split("")
    .map((c) => c.charCodeAt(0)));

// Generated using scripts/write-decode-map.ts
var xmlDecodeTree = new Uint16Array(
// prettier-ignore
"\u0200aglq\t\x15\x18\x1b\u026d\x0f\0\0\x12p;\u4026os;\u4027t;\u403et;\u403cuot;\u4022"
    .split("")
    .map((c) => c.charCodeAt(0)));

// Adapted from https://github.com/mathiasbynens/he/blob/36afe179392226cf1b6ccdb16ebbb7a5a844d93a/src/he.js#L106-L134
var _a;
const decodeMap = new Map([
    [0, 65533],
    // C1 Unicode control character reference replacements
    [128, 8364],
    [130, 8218],
    [131, 402],
    [132, 8222],
    [133, 8230],
    [134, 8224],
    [135, 8225],
    [136, 710],
    [137, 8240],
    [138, 352],
    [139, 8249],
    [140, 338],
    [142, 381],
    [145, 8216],
    [146, 8217],
    [147, 8220],
    [148, 8221],
    [149, 8226],
    [150, 8211],
    [151, 8212],
    [152, 732],
    [153, 8482],
    [154, 353],
    [155, 8250],
    [156, 339],
    [158, 382],
    [159, 376],
]);
/**
 * Polyfill for `String.fromCodePoint`. It is used to create a string from a Unicode code point.
 */
const fromCodePoint$1 = 
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, node/no-unsupported-features/es-builtins
(_a = String.fromCodePoint) !== null && _a !== void 0 ? _a : function (codePoint) {
    let output = "";
    if (codePoint > 0xffff) {
        codePoint -= 0x10000;
        output += String.fromCharCode(((codePoint >>> 10) & 0x3ff) | 0xd800);
        codePoint = 0xdc00 | (codePoint & 0x3ff);
    }
    output += String.fromCharCode(codePoint);
    return output;
};
/**
 * Replace the given code point with a replacement character if it is a
 * surrogate or is outside the valid range. Otherwise return the code
 * point unchanged.
 */
function replaceCodePoint(codePoint) {
    var _a;
    if ((codePoint >= 0xd800 && codePoint <= 0xdfff) || codePoint > 0x10ffff) {
        return 0xfffd;
    }
    return (_a = decodeMap.get(codePoint)) !== null && _a !== void 0 ? _a : codePoint;
}

var CharCodes;
(function (CharCodes) {
    CharCodes[CharCodes["NUM"] = 35] = "NUM";
    CharCodes[CharCodes["SEMI"] = 59] = "SEMI";
    CharCodes[CharCodes["EQUALS"] = 61] = "EQUALS";
    CharCodes[CharCodes["ZERO"] = 48] = "ZERO";
    CharCodes[CharCodes["NINE"] = 57] = "NINE";
    CharCodes[CharCodes["LOWER_A"] = 97] = "LOWER_A";
    CharCodes[CharCodes["LOWER_F"] = 102] = "LOWER_F";
    CharCodes[CharCodes["LOWER_X"] = 120] = "LOWER_X";
    CharCodes[CharCodes["LOWER_Z"] = 122] = "LOWER_Z";
    CharCodes[CharCodes["UPPER_A"] = 65] = "UPPER_A";
    CharCodes[CharCodes["UPPER_F"] = 70] = "UPPER_F";
    CharCodes[CharCodes["UPPER_Z"] = 90] = "UPPER_Z";
})(CharCodes || (CharCodes = {}));
/** Bit that needs to be set to convert an upper case ASCII character to lower case */
const TO_LOWER_BIT = 0b100000;
var BinTrieFlags;
(function (BinTrieFlags) {
    BinTrieFlags[BinTrieFlags["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
    BinTrieFlags[BinTrieFlags["BRANCH_LENGTH"] = 16256] = "BRANCH_LENGTH";
    BinTrieFlags[BinTrieFlags["JUMP_TABLE"] = 127] = "JUMP_TABLE";
})(BinTrieFlags || (BinTrieFlags = {}));
function isNumber(code) {
    return code >= CharCodes.ZERO && code <= CharCodes.NINE;
}
function isHexadecimalCharacter(code) {
    return ((code >= CharCodes.UPPER_A && code <= CharCodes.UPPER_F) ||
        (code >= CharCodes.LOWER_A && code <= CharCodes.LOWER_F));
}
function isAsciiAlphaNumeric(code) {
    return ((code >= CharCodes.UPPER_A && code <= CharCodes.UPPER_Z) ||
        (code >= CharCodes.LOWER_A && code <= CharCodes.LOWER_Z) ||
        isNumber(code));
}
/**
 * Checks if the given character is a valid end character for an entity in an attribute.
 *
 * Attribute values that aren't terminated properly aren't parsed, and shouldn't lead to a parser error.
 * See the example in https://html.spec.whatwg.org/multipage/parsing.html#named-character-reference-state
 */
function isEntityInAttributeInvalidEnd(code) {
    return code === CharCodes.EQUALS || isAsciiAlphaNumeric(code);
}
var EntityDecoderState;
(function (EntityDecoderState) {
    EntityDecoderState[EntityDecoderState["EntityStart"] = 0] = "EntityStart";
    EntityDecoderState[EntityDecoderState["NumericStart"] = 1] = "NumericStart";
    EntityDecoderState[EntityDecoderState["NumericDecimal"] = 2] = "NumericDecimal";
    EntityDecoderState[EntityDecoderState["NumericHex"] = 3] = "NumericHex";
    EntityDecoderState[EntityDecoderState["NamedEntity"] = 4] = "NamedEntity";
})(EntityDecoderState || (EntityDecoderState = {}));
var DecodingMode;
(function (DecodingMode) {
    /** Entities in text nodes that can end with any character. */
    DecodingMode[DecodingMode["Legacy"] = 0] = "Legacy";
    /** Only allow entities terminated with a semicolon. */
    DecodingMode[DecodingMode["Strict"] = 1] = "Strict";
    /** Entities in attributes have limitations on ending characters. */
    DecodingMode[DecodingMode["Attribute"] = 2] = "Attribute";
})(DecodingMode || (DecodingMode = {}));
/**
 * Token decoder with support of writing partial entities.
 */
class EntityDecoder {
    constructor(
    /** The tree used to decode entities. */
    decodeTree, 
    /**
     * The function that is called when a codepoint is decoded.
     *
     * For multi-byte named entities, this will be called multiple times,
     * with the second codepoint, and the same `consumed` value.
     *
     * @param codepoint The decoded codepoint.
     * @param consumed The number of bytes consumed by the decoder.
     */
    emitCodePoint, 
    /** An object that is used to produce errors. */
    errors) {
        this.decodeTree = decodeTree;
        this.emitCodePoint = emitCodePoint;
        this.errors = errors;
        /** The current state of the decoder. */
        this.state = EntityDecoderState.EntityStart;
        /** Characters that were consumed while parsing an entity. */
        this.consumed = 1;
        /**
         * The result of the entity.
         *
         * Either the result index of a numeric entity, or the codepoint of a
         * numeric entity.
         */
        this.result = 0;
        /** The current index in the decode tree. */
        this.treeIndex = 0;
        /** The number of characters that were consumed in excess. */
        this.excess = 1;
        /** The mode in which the decoder is operating. */
        this.decodeMode = DecodingMode.Strict;
    }
    /** Resets the instance to make it reusable. */
    startEntity(decodeMode) {
        this.decodeMode = decodeMode;
        this.state = EntityDecoderState.EntityStart;
        this.result = 0;
        this.treeIndex = 0;
        this.excess = 1;
        this.consumed = 1;
    }
    /**
     * Write an entity to the decoder. This can be called multiple times with partial entities.
     * If the entity is incomplete, the decoder will return -1.
     *
     * Mirrors the implementation of `getDecoder`, but with the ability to stop decoding if the
     * entity is incomplete, and resume when the next string is written.
     *
     * @param string The string containing the entity (or a continuation of the entity).
     * @param offset The offset at which the entity begins. Should be 0 if this is not the first call.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    write(str, offset) {
        switch (this.state) {
            case EntityDecoderState.EntityStart: {
                if (str.charCodeAt(offset) === CharCodes.NUM) {
                    this.state = EntityDecoderState.NumericStart;
                    this.consumed += 1;
                    return this.stateNumericStart(str, offset + 1);
                }
                this.state = EntityDecoderState.NamedEntity;
                return this.stateNamedEntity(str, offset);
            }
            case EntityDecoderState.NumericStart: {
                return this.stateNumericStart(str, offset);
            }
            case EntityDecoderState.NumericDecimal: {
                return this.stateNumericDecimal(str, offset);
            }
            case EntityDecoderState.NumericHex: {
                return this.stateNumericHex(str, offset);
            }
            case EntityDecoderState.NamedEntity: {
                return this.stateNamedEntity(str, offset);
            }
        }
    }
    /**
     * Switches between the numeric decimal and hexadecimal states.
     *
     * Equivalent to the `Numeric character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericStart(str, offset) {
        if (offset >= str.length) {
            return -1;
        }
        if ((str.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes.LOWER_X) {
            this.state = EntityDecoderState.NumericHex;
            this.consumed += 1;
            return this.stateNumericHex(str, offset + 1);
        }
        this.state = EntityDecoderState.NumericDecimal;
        return this.stateNumericDecimal(str, offset);
    }
    addToNumericResult(str, start, end, base) {
        if (start !== end) {
            const digitCount = end - start;
            this.result =
                this.result * Math.pow(base, digitCount) +
                    parseInt(str.substr(start, digitCount), base);
            this.consumed += digitCount;
        }
    }
    /**
     * Parses a hexadecimal numeric entity.
     *
     * Equivalent to the `Hexademical character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericHex(str, offset) {
        const startIdx = offset;
        while (offset < str.length) {
            const char = str.charCodeAt(offset);
            if (isNumber(char) || isHexadecimalCharacter(char)) {
                offset += 1;
            }
            else {
                this.addToNumericResult(str, startIdx, offset, 16);
                return this.emitNumericEntity(char, 3);
            }
        }
        this.addToNumericResult(str, startIdx, offset, 16);
        return -1;
    }
    /**
     * Parses a decimal numeric entity.
     *
     * Equivalent to the `Decimal character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericDecimal(str, offset) {
        const startIdx = offset;
        while (offset < str.length) {
            const char = str.charCodeAt(offset);
            if (isNumber(char)) {
                offset += 1;
            }
            else {
                this.addToNumericResult(str, startIdx, offset, 10);
                return this.emitNumericEntity(char, 2);
            }
        }
        this.addToNumericResult(str, startIdx, offset, 10);
        return -1;
    }
    /**
     * Validate and emit a numeric entity.
     *
     * Implements the logic from the `Hexademical character reference start
     * state` and `Numeric character reference end state` in the HTML spec.
     *
     * @param lastCp The last code point of the entity. Used to see if the
     *               entity was terminated with a semicolon.
     * @param expectedLength The minimum number of characters that should be
     *                       consumed. Used to validate that at least one digit
     *                       was consumed.
     * @returns The number of characters that were consumed.
     */
    emitNumericEntity(lastCp, expectedLength) {
        var _a;
        // Ensure we consumed at least one digit.
        if (this.consumed <= expectedLength) {
            (_a = this.errors) === null || _a === void 0 ? void 0 : _a.absenceOfDigitsInNumericCharacterReference(this.consumed);
            return 0;
        }
        // Figure out if this is a legit end of the entity
        if (lastCp === CharCodes.SEMI) {
            this.consumed += 1;
        }
        else if (this.decodeMode === DecodingMode.Strict) {
            return 0;
        }
        this.emitCodePoint(replaceCodePoint(this.result), this.consumed);
        if (this.errors) {
            if (lastCp !== CharCodes.SEMI) {
                this.errors.missingSemicolonAfterCharacterReference();
            }
            this.errors.validateNumericCharacterReference(this.result);
        }
        return this.consumed;
    }
    /**
     * Parses a named entity.
     *
     * Equivalent to the `Named character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNamedEntity(str, offset) {
        const { decodeTree } = this;
        let current = decodeTree[this.treeIndex];
        // The mask is the number of bytes of the value, including the current byte.
        let valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
        for (; offset < str.length; offset++, this.excess++) {
            const char = str.charCodeAt(offset);
            this.treeIndex = determineBranch(decodeTree, current, this.treeIndex + Math.max(1, valueLength), char);
            if (this.treeIndex < 0) {
                return this.result === 0 ||
                    // If we are parsing an attribute
                    (this.decodeMode === DecodingMode.Attribute &&
                        // We shouldn't have consumed any characters after the entity,
                        (valueLength === 0 ||
                            // And there should be no invalid characters.
                            isEntityInAttributeInvalidEnd(char)))
                    ? 0
                    : this.emitNotTerminatedNamedEntity();
            }
            current = decodeTree[this.treeIndex];
            valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
            // If the branch is a value, store it and continue
            if (valueLength !== 0) {
                // If the entity is terminated by a semicolon, we are done.
                if (char === CharCodes.SEMI) {
                    return this.emitNamedEntityData(this.treeIndex, valueLength, this.consumed + this.excess);
                }
                // If we encounter a non-terminated (legacy) entity while parsing strictly, then ignore it.
                if (this.decodeMode !== DecodingMode.Strict) {
                    this.result = this.treeIndex;
                    this.consumed += this.excess;
                    this.excess = 0;
                }
            }
        }
        return -1;
    }
    /**
     * Emit a named entity that was not terminated with a semicolon.
     *
     * @returns The number of characters consumed.
     */
    emitNotTerminatedNamedEntity() {
        var _a;
        const { result, decodeTree } = this;
        const valueLength = (decodeTree[result] & BinTrieFlags.VALUE_LENGTH) >> 14;
        this.emitNamedEntityData(result, valueLength, this.consumed);
        (_a = this.errors) === null || _a === void 0 ? void 0 : _a.missingSemicolonAfterCharacterReference();
        return this.consumed;
    }
    /**
     * Emit a named entity.
     *
     * @param result The index of the entity in the decode tree.
     * @param valueLength The number of bytes in the entity.
     * @param consumed The number of characters consumed.
     *
     * @returns The number of characters consumed.
     */
    emitNamedEntityData(result, valueLength, consumed) {
        const { decodeTree } = this;
        this.emitCodePoint(valueLength === 1
            ? decodeTree[result] & ~BinTrieFlags.VALUE_LENGTH
            : decodeTree[result + 1], consumed);
        if (valueLength === 3) {
            // For multi-byte values, we need to emit the second byte.
            this.emitCodePoint(decodeTree[result + 2], consumed);
        }
        return consumed;
    }
    /**
     * Signal to the parser that the end of the input was reached.
     *
     * Remaining data will be emitted and relevant errors will be produced.
     *
     * @returns The number of characters consumed.
     */
    end() {
        var _a;
        switch (this.state) {
            case EntityDecoderState.NamedEntity: {
                // Emit a named entity if we have one.
                return this.result !== 0 &&
                    (this.decodeMode !== DecodingMode.Attribute ||
                        this.result === this.treeIndex)
                    ? this.emitNotTerminatedNamedEntity()
                    : 0;
            }
            // Otherwise, emit a numeric entity if we have one.
            case EntityDecoderState.NumericDecimal: {
                return this.emitNumericEntity(0, 2);
            }
            case EntityDecoderState.NumericHex: {
                return this.emitNumericEntity(0, 3);
            }
            case EntityDecoderState.NumericStart: {
                (_a = this.errors) === null || _a === void 0 ? void 0 : _a.absenceOfDigitsInNumericCharacterReference(this.consumed);
                return 0;
            }
            case EntityDecoderState.EntityStart: {
                // Return 0 if we have no entity.
                return 0;
            }
        }
    }
}
/**
 * Creates a function that decodes entities in a string.
 *
 * @param decodeTree The decode tree.
 * @returns A function that decodes entities in a string.
 */
function getDecoder(decodeTree) {
    let ret = "";
    const decoder = new EntityDecoder(decodeTree, (str) => (ret += fromCodePoint$1(str)));
    return function decodeWithTrie(str, decodeMode) {
        let lastIndex = 0;
        let offset = 0;
        while ((offset = str.indexOf("&", offset)) >= 0) {
            ret += str.slice(lastIndex, offset);
            decoder.startEntity(decodeMode);
            const len = decoder.write(str, 
            // Skip the "&"
            offset + 1);
            if (len < 0) {
                lastIndex = offset + decoder.end();
                break;
            }
            lastIndex = offset + len;
            // If `len` is 0, skip the current `&` and continue.
            offset = len === 0 ? lastIndex + 1 : lastIndex;
        }
        const result = ret + str.slice(lastIndex);
        // Make sure we don't keep a reference to the final string.
        ret = "";
        return result;
    };
}
/**
 * Determines the branch of the current node that is taken given the current
 * character. This function is used to traverse the trie.
 *
 * @param decodeTree The trie.
 * @param current The current node.
 * @param nodeIdx The index right after the current node and its value.
 * @param char The current character.
 * @returns The index of the next node, or -1 if no branch is taken.
 */
function determineBranch(decodeTree, current, nodeIdx, char) {
    const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
    const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
    // Case 1: Single branch encoded in jump offset
    if (branchCount === 0) {
        return jumpOffset !== 0 && char === jumpOffset ? nodeIdx : -1;
    }
    // Case 2: Multiple branches encoded in jump table
    if (jumpOffset) {
        const value = char - jumpOffset;
        return value < 0 || value >= branchCount
            ? -1
            : decodeTree[nodeIdx + value] - 1;
    }
    // Case 3: Multiple branches encoded in dictionary
    // Binary search for the character.
    let lo = nodeIdx;
    let hi = lo + branchCount - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const midVal = decodeTree[mid];
        if (midVal < char) {
            lo = mid + 1;
        }
        else if (midVal > char) {
            hi = mid - 1;
        }
        else {
            return decodeTree[mid + branchCount];
        }
    }
    return -1;
}
const htmlDecoder = getDecoder(htmlDecodeTree);
getDecoder(xmlDecodeTree);
/**
 * Decodes an HTML string.
 *
 * @param str The string to decode.
 * @param mode The decoding mode.
 * @returns The decoded string.
 */
function decodeHTML(str, mode = DecodingMode.Legacy) {
    return htmlDecoder(str, mode);
}

// Utilities
//


function _class$1 (obj) { return Object.prototype.toString.call(obj) }

function isString$1 (obj) { return _class$1(obj) === '[object String]' }

const _hasOwnProperty = Object.prototype.hasOwnProperty;

function has (object, key) {
  return _hasOwnProperty.call(object, key)
}

// Merge objects
//
function assign$1 (obj /* from1, from2, from3, ... */) {
  const sources = Array.prototype.slice.call(arguments, 1);

  sources.forEach(function (source) {
    if (!source) { return }

    if (typeof source !== 'object') {
      throw new TypeError(source + 'must be object')
    }

    Object.keys(source).forEach(function (key) {
      obj[key] = source[key];
    });
  });

  return obj
}

// Remove element from array and put another array at those position.
// Useful for some operations with tokens
function arrayReplaceAt (src, pos, newElements) {
  return [].concat(src.slice(0, pos), newElements, src.slice(pos + 1))
}

function isValidEntityCode (c) {
  /* eslint no-bitwise:0 */
  // broken sequence
  if (c >= 0xD800 && c <= 0xDFFF) { return false }
  // never used
  if (c >= 0xFDD0 && c <= 0xFDEF) { return false }
  if ((c & 0xFFFF) === 0xFFFF || (c & 0xFFFF) === 0xFFFE) { return false }
  // control codes
  if (c >= 0x00 && c <= 0x08) { return false }
  if (c === 0x0B) { return false }
  if (c >= 0x0E && c <= 0x1F) { return false }
  if (c >= 0x7F && c <= 0x9F) { return false }
  // out of range
  if (c > 0x10FFFF) { return false }
  return true
}

function fromCodePoint (c) {
  /* eslint no-bitwise:0 */
  if (c > 0xffff) {
    c -= 0x10000;
    const surrogate1 = 0xd800 + (c >> 10);
    const surrogate2 = 0xdc00 + (c & 0x3ff);

    return String.fromCharCode(surrogate1, surrogate2)
  }
  return String.fromCharCode(c)
}

const UNESCAPE_MD_RE  = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;
const ENTITY_RE       = /&([a-z#][a-z0-9]{1,31});/gi;
const UNESCAPE_ALL_RE = new RegExp(UNESCAPE_MD_RE.source + '|' + ENTITY_RE.source, 'gi');

const DIGITAL_ENTITY_TEST_RE = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))$/i;

function replaceEntityPattern (match, name) {
  if (name.charCodeAt(0) === 0x23/* # */ && DIGITAL_ENTITY_TEST_RE.test(name)) {
    const code = name[1].toLowerCase() === 'x'
      ? parseInt(name.slice(2), 16)
      : parseInt(name.slice(1), 10);

    if (isValidEntityCode(code)) {
      return fromCodePoint(code)
    }

    return match
  }

  const decoded = decodeHTML(match);
  if (decoded !== match) {
    return decoded
  }

  return match
}

/* function replaceEntities(str) {
  if (str.indexOf('&') < 0) { return str; }

  return str.replace(ENTITY_RE, replaceEntityPattern);
} */

function unescapeMd (str) {
  if (str.indexOf('\\') < 0) { return str }
  return str.replace(UNESCAPE_MD_RE, '$1')
}

function unescapeAll (str) {
  if (str.indexOf('\\') < 0 && str.indexOf('&') < 0) { return str }

  return str.replace(UNESCAPE_ALL_RE, function (match, escaped, entity) {
    if (escaped) { return escaped }
    return replaceEntityPattern(match, entity)
  })
}

const HTML_ESCAPE_TEST_RE = /[&<>"]/;
const HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
const HTML_REPLACEMENTS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
};

function replaceUnsafeChar (ch) {
  return HTML_REPLACEMENTS[ch]
}

function escapeHtml (str) {
  if (HTML_ESCAPE_TEST_RE.test(str)) {
    return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar)
  }
  return str
}

const REGEXP_ESCAPE_RE = /[.?*+^$[\]\\(){}|-]/g;

function escapeRE$1 (str) {
  return str.replace(REGEXP_ESCAPE_RE, '\\$&')
}

function isSpace (code) {
  switch (code) {
    case 0x09:
    case 0x20:
      return true
  }
  return false
}

// Zs (unicode class) || [\t\f\v\r\n]
function isWhiteSpace (code) {
  if (code >= 0x2000 && code <= 0x200A) { return true }
  switch (code) {
    case 0x09: // \t
    case 0x0A: // \n
    case 0x0B: // \v
    case 0x0C: // \f
    case 0x0D: // \r
    case 0x20:
    case 0xA0:
    case 0x1680:
    case 0x202F:
    case 0x205F:
    case 0x3000:
      return true
  }
  return false
}

/* eslint-disable max-len */

// Currently without astral characters support.
function isPunctChar (ch) {
  return P.test(ch) || regex.test(ch)
}

// Markdown ASCII punctuation characters.
//
// !, ", #, $, %, &, ', (, ), *, +, ,, -, ., /, :, ;, <, =, >, ?, @, [, \, ], ^, _, `, {, |, }, or ~
// http://spec.commonmark.org/0.15/#ascii-punctuation-character
//
// Don't confuse with unicode punctuation !!! It lacks some chars in ascii range.
//
function isMdAsciiPunct (ch) {
  switch (ch) {
    case 0x21/* ! */:
    case 0x22/* " */:
    case 0x23/* # */:
    case 0x24/* $ */:
    case 0x25/* % */:
    case 0x26/* & */:
    case 0x27/* ' */:
    case 0x28/* ( */:
    case 0x29/* ) */:
    case 0x2A/* * */:
    case 0x2B/* + */:
    case 0x2C/* , */:
    case 0x2D/* - */:
    case 0x2E/* . */:
    case 0x2F/* / */:
    case 0x3A/* : */:
    case 0x3B/* ; */:
    case 0x3C/* < */:
    case 0x3D/* = */:
    case 0x3E/* > */:
    case 0x3F/* ? */:
    case 0x40/* @ */:
    case 0x5B/* [ */:
    case 0x5C/* \ */:
    case 0x5D/* ] */:
    case 0x5E/* ^ */:
    case 0x5F/* _ */:
    case 0x60/* ` */:
    case 0x7B/* { */:
    case 0x7C/* | */:
    case 0x7D/* } */:
    case 0x7E/* ~ */:
      return true
    default:
      return false
  }
}

// Hepler to unify [reference labels].
//
function normalizeReference (str) {
  // Trim and collapse whitespace
  //
  str = str.trim().replace(/\s+/g, ' ');

  // In node v10 'ẞ'.toLowerCase() === 'Ṿ', which is presumed to be a bug
  // fixed in v12 (couldn't find any details).
  //
  // So treat this one as a special case
  // (remove this when node v10 is no longer supported).
  //
  if ('ẞ'.toLowerCase() === 'Ṿ') {
    str = str.replace(/ẞ/g, 'ß');
  }

  // .toLowerCase().toUpperCase() should get rid of all differences
  // between letter variants.
  //
  // Simple .toLowerCase() doesn't normalize 125 code points correctly,
  // and .toUpperCase doesn't normalize 6 of them (list of exceptions:
  // İ, ϴ, ẞ, Ω, K, Å - those are already uppercased, but have differently
  // uppercased versions).
  //
  // Here's an example showing how it happens. Lets take greek letter omega:
  // uppercase U+0398 (Θ), U+03f4 (ϴ) and lowercase U+03b8 (θ), U+03d1 (ϑ)
  //
  // Unicode entries:
  // 0398;GREEK CAPITAL LETTER THETA;Lu;0;L;;;;;N;;;;03B8;
  // 03B8;GREEK SMALL LETTER THETA;Ll;0;L;;;;;N;;;0398;;0398
  // 03D1;GREEK THETA SYMBOL;Ll;0;L;<compat> 03B8;;;;N;GREEK SMALL LETTER SCRIPT THETA;;0398;;0398
  // 03F4;GREEK CAPITAL THETA SYMBOL;Lu;0;L;<compat> 0398;;;;N;;;;03B8;
  //
  // Case-insensitive comparison should treat all of them as equivalent.
  //
  // But .toLowerCase() doesn't change ϑ (it's already lowercase),
  // and .toUpperCase() doesn't change ϴ (already uppercase).
  //
  // Applying first lower then upper case normalizes any character:
  // '\u0398\u03f4\u03b8\u03d1'.toLowerCase().toUpperCase() === '\u0398\u0398\u0398\u0398'
  //
  // Note: this is equivalent to unicode case folding; unicode normalization
  // is a different step that is not required here.
  //
  // Final result should be uppercased, because it's later stored in an object
  // (this avoid a conflict with Object.prototype members,
  // most notably, `__proto__`)
  //
  return str.toLowerCase().toUpperCase()
}

// Re-export libraries commonly used in both markdown-it and its plugins,
// so plugins won't have to depend on them explicitly, which reduces their
// bundled size (e.g. a browser build).
//
const lib = { mdurl, ucmicro };

var utils = /*#__PURE__*/Object.freeze({
    __proto__: null,
    arrayReplaceAt: arrayReplaceAt,
    assign: assign$1,
    escapeHtml: escapeHtml,
    escapeRE: escapeRE$1,
    fromCodePoint: fromCodePoint,
    has: has,
    isMdAsciiPunct: isMdAsciiPunct,
    isPunctChar: isPunctChar,
    isSpace: isSpace,
    isString: isString$1,
    isValidEntityCode: isValidEntityCode,
    isWhiteSpace: isWhiteSpace,
    lib: lib,
    normalizeReference: normalizeReference,
    unescapeAll: unescapeAll,
    unescapeMd: unescapeMd
});

// Parse link label
//
// this function assumes that first character ("[") already matches;
// returns the end of the label
//

function parseLinkLabel (state, start, disableNested) {
  let level, found, marker, prevPos;

  const max = state.posMax;
  const oldPos = state.pos;

  state.pos = start + 1;
  level = 1;

  while (state.pos < max) {
    marker = state.src.charCodeAt(state.pos);
    if (marker === 0x5D /* ] */) {
      level--;
      if (level === 0) {
        found = true;
        break
      }
    }

    prevPos = state.pos;
    state.md.inline.skipToken(state);
    if (marker === 0x5B /* [ */) {
      if (prevPos === state.pos - 1) {
        // increase level if we find text `[`, which is not a part of any token
        level++;
      } else if (disableNested) {
        state.pos = oldPos;
        return -1
      }
    }
  }

  let labelEnd = -1;

  if (found) {
    labelEnd = state.pos;
  }

  // restore old state
  state.pos = oldPos;

  return labelEnd
}

// Parse link destination
//


function parseLinkDestination (str, start, max) {
  let code;
  let pos = start;

  const result = {
    ok: false,
    pos: 0,
    str: ''
  };

  if (str.charCodeAt(pos) === 0x3C /* < */) {
    pos++;
    while (pos < max) {
      code = str.charCodeAt(pos);
      if (code === 0x0A /* \n */) { return result }
      if (code === 0x3C /* < */) { return result }
      if (code === 0x3E /* > */) {
        result.pos = pos + 1;
        result.str = unescapeAll(str.slice(start + 1, pos));
        result.ok = true;
        return result
      }
      if (code === 0x5C /* \ */ && pos + 1 < max) {
        pos += 2;
        continue
      }

      pos++;
    }

    // no closing '>'
    return result
  }

  // this should be ... } else { ... branch

  let level = 0;
  while (pos < max) {
    code = str.charCodeAt(pos);

    if (code === 0x20) { break }

    // ascii control characters
    if (code < 0x20 || code === 0x7F) { break }

    if (code === 0x5C /* \ */ && pos + 1 < max) {
      if (str.charCodeAt(pos + 1) === 0x20) { break }
      pos += 2;
      continue
    }

    if (code === 0x28 /* ( */) {
      level++;
      if (level > 32) { return result }
    }

    if (code === 0x29 /* ) */) {
      if (level === 0) { break }
      level--;
    }

    pos++;
  }

  if (start === pos) { return result }
  if (level !== 0) { return result }

  result.str = unescapeAll(str.slice(start, pos));
  result.pos = pos;
  result.ok = true;
  return result
}

// Parse link title
//


// Parse link title within `str` in [start, max] range,
// or continue previous parsing if `prev_state` is defined (equal to result of last execution).
//
function parseLinkTitle (str, start, max, prev_state) {
  let code;
  let pos = start;

  const state = {
    // if `true`, this is a valid link title
    ok: false,
    // if `true`, this link can be continued on the next line
    can_continue: false,
    // if `ok`, it's the position of the first character after the closing marker
    pos: 0,
    // if `ok`, it's the unescaped title
    str: '',
    // expected closing marker character code
    marker: 0
  };

  if (prev_state) {
    // this is a continuation of a previous parseLinkTitle call on the next line,
    // used in reference links only
    state.str = prev_state.str;
    state.marker = prev_state.marker;
  } else {
    if (pos >= max) { return state }

    let marker = str.charCodeAt(pos);
    if (marker !== 0x22 /* " */ && marker !== 0x27 /* ' */ && marker !== 0x28 /* ( */) { return state }

    start++;
    pos++;

    // if opening marker is "(", switch it to closing marker ")"
    if (marker === 0x28) { marker = 0x29; }

    state.marker = marker;
  }

  while (pos < max) {
    code = str.charCodeAt(pos);
    if (code === state.marker) {
      state.pos = pos + 1;
      state.str += unescapeAll(str.slice(start, pos));
      state.ok = true;
      return state
    } else if (code === 0x28 /* ( */ && state.marker === 0x29 /* ) */) {
      return state
    } else if (code === 0x5C /* \ */ && pos + 1 < max) {
      pos++;
    }

    pos++;
  }

  // no closing marker found, but this link title may continue on the next line (for references)
  state.can_continue = true;
  state.str += unescapeAll(str.slice(start, pos));
  return state
}

// Just a shortcut for bulk export

var helpers = /*#__PURE__*/Object.freeze({
    __proto__: null,
    parseLinkDestination: parseLinkDestination,
    parseLinkLabel: parseLinkLabel,
    parseLinkTitle: parseLinkTitle
});

/**
 * class Renderer
 *
 * Generates HTML from parsed token stream. Each instance has independent
 * copy of rules. Those can be rewritten with ease. Also, you can add new
 * rules if you create plugin and adds new token types.
 **/


const default_rules = {};

default_rules.code_inline = function (tokens, idx, options, env, slf) {
  const token = tokens[idx];

  return  '<code' + slf.renderAttrs(token) + '>' +
          escapeHtml(token.content) +
          '</code>'
};

default_rules.code_block = function (tokens, idx, options, env, slf) {
  const token = tokens[idx];

  return  '<pre' + slf.renderAttrs(token) + '><code>' +
          escapeHtml(tokens[idx].content) +
          '</code></pre>\n'
};

default_rules.fence = function (tokens, idx, options, env, slf) {
  const token = tokens[idx];
  const info = token.info ? unescapeAll(token.info).trim() : '';
  let langName = '';
  let langAttrs = '';

  if (info) {
    const arr = info.split(/(\s+)/g);
    langName = arr[0];
    langAttrs = arr.slice(2).join('');
  }

  let highlighted;
  if (options.highlight) {
    highlighted = options.highlight(token.content, langName, langAttrs) || escapeHtml(token.content);
  } else {
    highlighted = escapeHtml(token.content);
  }

  if (highlighted.indexOf('<pre') === 0) {
    return highlighted + '\n'
  }

  // If language exists, inject class gently, without modifying original token.
  // May be, one day we will add .deepClone() for token and simplify this part, but
  // now we prefer to keep things local.
  if (info) {
    const i = token.attrIndex('class');
    const tmpAttrs = token.attrs ? token.attrs.slice() : [];

    if (i < 0) {
      tmpAttrs.push(['class', options.langPrefix + langName]);
    } else {
      tmpAttrs[i] = tmpAttrs[i].slice();
      tmpAttrs[i][1] += ' ' + options.langPrefix + langName;
    }

    // Fake token just to render attributes
    const tmpToken = {
      attrs: tmpAttrs
    };

    return `<pre><code${slf.renderAttrs(tmpToken)}>${highlighted}</code></pre>\n`
  }

  return `<pre><code${slf.renderAttrs(token)}>${highlighted}</code></pre>\n`
};

default_rules.image = function (tokens, idx, options, env, slf) {
  const token = tokens[idx];

  // "alt" attr MUST be set, even if empty. Because it's mandatory and
  // should be placed on proper position for tests.
  //
  // Replace content with actual value

  token.attrs[token.attrIndex('alt')][1] =
    slf.renderInlineAsText(token.children, options, env);

  return slf.renderToken(tokens, idx, options)
};

default_rules.hardbreak = function (tokens, idx, options /*, env */) {
  return options.xhtmlOut ? '<br />\n' : '<br>\n'
};
default_rules.softbreak = function (tokens, idx, options /*, env */) {
  return options.breaks ? (options.xhtmlOut ? '<br />\n' : '<br>\n') : '\n'
};

default_rules.text = function (tokens, idx /*, options, env */) {
  return escapeHtml(tokens[idx].content)
};

default_rules.html_block = function (tokens, idx /*, options, env */) {
  return tokens[idx].content
};
default_rules.html_inline = function (tokens, idx /*, options, env */) {
  return tokens[idx].content
};

/**
 * new Renderer()
 *
 * Creates new [[Renderer]] instance and fill [[Renderer#rules]] with defaults.
 **/
function Renderer$1 () {
  /**
   * Renderer#rules -> Object
   *
   * Contains render rules for tokens. Can be updated and extended.
   *
   * ##### Example
   *
   * ```javascript
   * var md = require('markdown-it')();
   *
   * md.renderer.rules.strong_open  = function () { return '<b>'; };
   * md.renderer.rules.strong_close = function () { return '</b>'; };
   *
   * var result = md.renderInline(...);
   * ```
   *
   * Each rule is called as independent static function with fixed signature:
   *
   * ```javascript
   * function my_token_render(tokens, idx, options, env, renderer) {
   *   // ...
   *   return renderedHTML;
   * }
   * ```
   *
   * See [source code](https://github.com/markdown-it/markdown-it/blob/master/lib/renderer.mjs)
   * for more details and examples.
   **/
  this.rules = assign$1({}, default_rules);
}

/**
 * Renderer.renderAttrs(token) -> String
 *
 * Render token attributes to string.
 **/
Renderer$1.prototype.renderAttrs = function renderAttrs (token) {
  let i, l, result;

  if (!token.attrs) { return '' }

  result = '';

  for (i = 0, l = token.attrs.length; i < l; i++) {
    result += ' ' + escapeHtml(token.attrs[i][0]) + '="' + escapeHtml(token.attrs[i][1]) + '"';
  }

  return result
};

/**
 * Renderer.renderToken(tokens, idx, options) -> String
 * - tokens (Array): list of tokens
 * - idx (Numbed): token index to render
 * - options (Object): params of parser instance
 *
 * Default token renderer. Can be overriden by custom function
 * in [[Renderer#rules]].
 **/
Renderer$1.prototype.renderToken = function renderToken (tokens, idx, options) {
  const token = tokens[idx];
  let result = '';

  // Tight list paragraphs
  if (token.hidden) {
    return ''
  }

  // Insert a newline between hidden paragraph and subsequent opening
  // block-level tag.
  //
  // For example, here we should insert a newline before blockquote:
  //  - a
  //    >
  //
  if (token.block && token.nesting !== -1 && idx && tokens[idx - 1].hidden) {
    result += '\n';
  }

  // Add token name, e.g. `<img`
  result += (token.nesting === -1 ? '</' : '<') + token.tag;

  // Encode attributes, e.g. `<img src="foo"`
  result += this.renderAttrs(token);

  // Add a slash for self-closing tags, e.g. `<img src="foo" /`
  if (token.nesting === 0 && options.xhtmlOut) {
    result += ' /';
  }

  // Check if we need to add a newline after this tag
  let needLf = false;
  if (token.block) {
    needLf = true;

    if (token.nesting === 1) {
      if (idx + 1 < tokens.length) {
        const nextToken = tokens[idx + 1];

        if (nextToken.type === 'inline' || nextToken.hidden) {
          // Block-level tag containing an inline tag.
          //
          needLf = false;
        } else if (nextToken.nesting === -1 && nextToken.tag === token.tag) {
          // Opening tag + closing tag of the same type. E.g. `<li></li>`.
          //
          needLf = false;
        }
      }
    }
  }

  result += needLf ? '>\n' : '>';

  return result
};

/**
 * Renderer.renderInline(tokens, options, env) -> String
 * - tokens (Array): list on block tokens to render
 * - options (Object): params of parser instance
 * - env (Object): additional data from parsed input (references, for example)
 *
 * The same as [[Renderer.render]], but for single token of `inline` type.
 **/
Renderer$1.prototype.renderInline = function (tokens, options, env) {
  let result = '';
  const rules = this.rules;

  for (let i = 0, len = tokens.length; i < len; i++) {
    const type = tokens[i].type;

    if (typeof rules[type] !== 'undefined') {
      result += rules[type](tokens, i, options, env, this);
    } else {
      result += this.renderToken(tokens, i, options);
    }
  }

  return result
};

/** internal
 * Renderer.renderInlineAsText(tokens, options, env) -> String
 * - tokens (Array): list on block tokens to render
 * - options (Object): params of parser instance
 * - env (Object): additional data from parsed input (references, for example)
 *
 * Special kludge for image `alt` attributes to conform CommonMark spec.
 * Don't try to use it! Spec requires to show `alt` content with stripped markup,
 * instead of simple escaping.
 **/
Renderer$1.prototype.renderInlineAsText = function (tokens, options, env) {
  let result = '';

  for (let i = 0, len = tokens.length; i < len; i++) {
    switch (tokens[i].type) {
      case 'text':
        result += tokens[i].content;
        break
      case 'image':
        result += this.renderInlineAsText(tokens[i].children, options, env);
        break
      case 'html_inline':
      case 'html_block':
        result += tokens[i].content;
        break
      case 'softbreak':
      case 'hardbreak':
        result += '\n';
        break
        // all other tokens are skipped
    }
  }

  return result
};

/**
 * Renderer.render(tokens, options, env) -> String
 * - tokens (Array): list on block tokens to render
 * - options (Object): params of parser instance
 * - env (Object): additional data from parsed input (references, for example)
 *
 * Takes token stream and generates HTML. Probably, you will never need to call
 * this method directly.
 **/
Renderer$1.prototype.render = function (tokens, options, env) {
  let result = '';
  const rules = this.rules;

  for (let i = 0, len = tokens.length; i < len; i++) {
    const type = tokens[i].type;

    if (type === 'inline') {
      result += this.renderInline(tokens[i].children, options, env);
    } else if (typeof rules[type] !== 'undefined') {
      result += rules[type](tokens, i, options, env, this);
    } else {
      result += this.renderToken(tokens, i, options, env);
    }
  }

  return result
};

/**
 * class Ruler
 *
 * Helper class, used by [[MarkdownIt#core]], [[MarkdownIt#block]] and
 * [[MarkdownIt#inline]] to manage sequences of functions (rules):
 *
 * - keep rules in defined order
 * - assign the name to each rule
 * - enable/disable rules
 * - add/replace rules
 * - allow assign rules to additional named chains (in the same)
 * - cacheing lists of active rules
 *
 * You will not need use this class directly until write plugins. For simple
 * rules control use [[MarkdownIt.disable]], [[MarkdownIt.enable]] and
 * [[MarkdownIt.use]].
 **/

/**
 * new Ruler()
 **/
function Ruler () {
  // List of added rules. Each element is:
  //
  // {
  //   name: XXX,
  //   enabled: Boolean,
  //   fn: Function(),
  //   alt: [ name2, name3 ]
  // }
  //
  this.__rules__ = [];

  // Cached rule chains.
  //
  // First level - chain name, '' for default.
  // Second level - diginal anchor for fast filtering by charcodes.
  //
  this.__cache__ = null;
}

// Helper methods, should not be used directly

// Find rule index by name
//
Ruler.prototype.__find__ = function (name) {
  for (let i = 0; i < this.__rules__.length; i++) {
    if (this.__rules__[i].name === name) {
      return i
    }
  }
  return -1
};

// Build rules lookup cache
//
Ruler.prototype.__compile__ = function () {
  const self = this;
  const chains = [''];

  // collect unique names
  self.__rules__.forEach(function (rule) {
    if (!rule.enabled) { return }

    rule.alt.forEach(function (altName) {
      if (chains.indexOf(altName) < 0) {
        chains.push(altName);
      }
    });
  });

  self.__cache__ = {};

  chains.forEach(function (chain) {
    self.__cache__[chain] = [];
    self.__rules__.forEach(function (rule) {
      if (!rule.enabled) { return }

      if (chain && rule.alt.indexOf(chain) < 0) { return }

      self.__cache__[chain].push(rule.fn);
    });
  });
};

/**
 * Ruler.at(name, fn [, options])
 * - name (String): rule name to replace.
 * - fn (Function): new rule function.
 * - options (Object): new rule options (not mandatory).
 *
 * Replace rule by name with new function & options. Throws error if name not
 * found.
 *
 * ##### Options:
 *
 * - __alt__ - array with names of "alternate" chains.
 *
 * ##### Example
 *
 * Replace existing typographer replacement rule with new one:
 *
 * ```javascript
 * var md = require('markdown-it')();
 *
 * md.core.ruler.at('replacements', function replace(state) {
 *   //...
 * });
 * ```
 **/
Ruler.prototype.at = function (name, fn, options) {
  const index = this.__find__(name);
  const opt = options || {};

  if (index === -1) { throw new Error('Parser rule not found: ' + name) }

  this.__rules__[index].fn = fn;
  this.__rules__[index].alt = opt.alt || [];
  this.__cache__ = null;
};

/**
 * Ruler.before(beforeName, ruleName, fn [, options])
 * - beforeName (String): new rule will be added before this one.
 * - ruleName (String): name of added rule.
 * - fn (Function): rule function.
 * - options (Object): rule options (not mandatory).
 *
 * Add new rule to chain before one with given name. See also
 * [[Ruler.after]], [[Ruler.push]].
 *
 * ##### Options:
 *
 * - __alt__ - array with names of "alternate" chains.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')();
 *
 * md.block.ruler.before('paragraph', 'my_rule', function replace(state) {
 *   //...
 * });
 * ```
 **/
Ruler.prototype.before = function (beforeName, ruleName, fn, options) {
  const index = this.__find__(beforeName);
  const opt = options || {};

  if (index === -1) { throw new Error('Parser rule not found: ' + beforeName) }

  this.__rules__.splice(index, 0, {
    name: ruleName,
    enabled: true,
    fn,
    alt: opt.alt || []
  });

  this.__cache__ = null;
};

/**
 * Ruler.after(afterName, ruleName, fn [, options])
 * - afterName (String): new rule will be added after this one.
 * - ruleName (String): name of added rule.
 * - fn (Function): rule function.
 * - options (Object): rule options (not mandatory).
 *
 * Add new rule to chain after one with given name. See also
 * [[Ruler.before]], [[Ruler.push]].
 *
 * ##### Options:
 *
 * - __alt__ - array with names of "alternate" chains.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')();
 *
 * md.inline.ruler.after('text', 'my_rule', function replace(state) {
 *   //...
 * });
 * ```
 **/
Ruler.prototype.after = function (afterName, ruleName, fn, options) {
  const index = this.__find__(afterName);
  const opt = options || {};

  if (index === -1) { throw new Error('Parser rule not found: ' + afterName) }

  this.__rules__.splice(index + 1, 0, {
    name: ruleName,
    enabled: true,
    fn,
    alt: opt.alt || []
  });

  this.__cache__ = null;
};

/**
 * Ruler.push(ruleName, fn [, options])
 * - ruleName (String): name of added rule.
 * - fn (Function): rule function.
 * - options (Object): rule options (not mandatory).
 *
 * Push new rule to the end of chain. See also
 * [[Ruler.before]], [[Ruler.after]].
 *
 * ##### Options:
 *
 * - __alt__ - array with names of "alternate" chains.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')();
 *
 * md.core.ruler.push('my_rule', function replace(state) {
 *   //...
 * });
 * ```
 **/
Ruler.prototype.push = function (ruleName, fn, options) {
  const opt = options || {};

  this.__rules__.push({
    name: ruleName,
    enabled: true,
    fn,
    alt: opt.alt || []
  });

  this.__cache__ = null;
};

/**
 * Ruler.enable(list [, ignoreInvalid]) -> Array
 * - list (String|Array): list of rule names to enable.
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * Enable rules with given names. If any rule name not found - throw Error.
 * Errors can be disabled by second param.
 *
 * Returns list of found rule names (if no exception happened).
 *
 * See also [[Ruler.disable]], [[Ruler.enableOnly]].
 **/
Ruler.prototype.enable = function (list, ignoreInvalid) {
  if (!Array.isArray(list)) { list = [list]; }

  const result = [];

  // Search by name and enable
  list.forEach(function (name) {
    const idx = this.__find__(name);

    if (idx < 0) {
      if (ignoreInvalid) { return }
      throw new Error('Rules manager: invalid rule name ' + name)
    }
    this.__rules__[idx].enabled = true;
    result.push(name);
  }, this);

  this.__cache__ = null;
  return result
};

/**
 * Ruler.enableOnly(list [, ignoreInvalid])
 * - list (String|Array): list of rule names to enable (whitelist).
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * Enable rules with given names, and disable everything else. If any rule name
 * not found - throw Error. Errors can be disabled by second param.
 *
 * See also [[Ruler.disable]], [[Ruler.enable]].
 **/
Ruler.prototype.enableOnly = function (list, ignoreInvalid) {
  if (!Array.isArray(list)) { list = [list]; }

  this.__rules__.forEach(function (rule) { rule.enabled = false; });

  this.enable(list, ignoreInvalid);
};

/**
 * Ruler.disable(list [, ignoreInvalid]) -> Array
 * - list (String|Array): list of rule names to disable.
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * Disable rules with given names. If any rule name not found - throw Error.
 * Errors can be disabled by second param.
 *
 * Returns list of found rule names (if no exception happened).
 *
 * See also [[Ruler.enable]], [[Ruler.enableOnly]].
 **/
Ruler.prototype.disable = function (list, ignoreInvalid) {
  if (!Array.isArray(list)) { list = [list]; }

  const result = [];

  // Search by name and disable
  list.forEach(function (name) {
    const idx = this.__find__(name);

    if (idx < 0) {
      if (ignoreInvalid) { return }
      throw new Error('Rules manager: invalid rule name ' + name)
    }
    this.__rules__[idx].enabled = false;
    result.push(name);
  }, this);

  this.__cache__ = null;
  return result
};

/**
 * Ruler.getRules(chainName) -> Array
 *
 * Return array of active functions (rules) for given chain name. It analyzes
 * rules configuration, compiles caches if not exists and returns result.
 *
 * Default chain name is `''` (empty string). It can't be skipped. That's
 * done intentionally, to keep signature monomorphic for high speed.
 **/
Ruler.prototype.getRules = function (chainName) {
  if (this.__cache__ === null) {
    this.__compile__();
  }

  // Chain can be empty, if rules disabled. But we still have to return Array.
  return this.__cache__[chainName] || []
};

// Token class

/**
 * class Token
 **/

/**
 * new Token(type, tag, nesting)
 *
 * Create new token and fill passed properties.
 **/
function Token (type, tag, nesting) {
  /**
   * Token#type -> String
   *
   * Type of the token (string, e.g. "paragraph_open")
   **/
  this.type     = type;

  /**
   * Token#tag -> String
   *
   * html tag name, e.g. "p"
   **/
  this.tag      = tag;

  /**
   * Token#attrs -> Array
   *
   * Html attributes. Format: `[ [ name1, value1 ], [ name2, value2 ] ]`
   **/
  this.attrs    = null;

  /**
   * Token#map -> Array
   *
   * Source map info. Format: `[ line_begin, line_end ]`
   **/
  this.map      = null;

  /**
   * Token#nesting -> Number
   *
   * Level change (number in {-1, 0, 1} set), where:
   *
   * -  `1` means the tag is opening
   * -  `0` means the tag is self-closing
   * - `-1` means the tag is closing
   **/
  this.nesting  = nesting;

  /**
   * Token#level -> Number
   *
   * nesting level, the same as `state.level`
   **/
  this.level    = 0;

  /**
   * Token#children -> Array
   *
   * An array of child nodes (inline and img tokens)
   **/
  this.children = null;

  /**
   * Token#content -> String
   *
   * In a case of self-closing tag (code, html, fence, etc.),
   * it has contents of this tag.
   **/
  this.content  = '';

  /**
   * Token#markup -> String
   *
   * '*' or '_' for emphasis, fence string for fence, etc.
   **/
  this.markup   = '';

  /**
   * Token#info -> String
   *
   * Additional information:
   *
   * - Info string for "fence" tokens
   * - The value "auto" for autolink "link_open" and "link_close" tokens
   * - The string value of the item marker for ordered-list "list_item_open" tokens
   **/
  this.info     = '';

  /**
   * Token#meta -> Object
   *
   * A place for plugins to store an arbitrary data
   **/
  this.meta     = null;

  /**
   * Token#block -> Boolean
   *
   * True for block-level tokens, false for inline tokens.
   * Used in renderer to calculate line breaks
   **/
  this.block    = false;

  /**
   * Token#hidden -> Boolean
   *
   * If it's true, ignore this element when rendering. Used for tight lists
   * to hide paragraphs.
   **/
  this.hidden   = false;
}

/**
 * Token.attrIndex(name) -> Number
 *
 * Search attribute index by name.
 **/
Token.prototype.attrIndex = function attrIndex (name) {
  if (!this.attrs) { return -1 }

  const attrs = this.attrs;

  for (let i = 0, len = attrs.length; i < len; i++) {
    if (attrs[i][0] === name) { return i }
  }
  return -1
};

/**
 * Token.attrPush(attrData)
 *
 * Add `[ name, value ]` attribute to list. Init attrs if necessary
 **/
Token.prototype.attrPush = function attrPush (attrData) {
  if (this.attrs) {
    this.attrs.push(attrData);
  } else {
    this.attrs = [attrData];
  }
};

/**
 * Token.attrSet(name, value)
 *
 * Set `name` attribute to `value`. Override old value if exists.
 **/
Token.prototype.attrSet = function attrSet (name, value) {
  const idx = this.attrIndex(name);
  const attrData = [name, value];

  if (idx < 0) {
    this.attrPush(attrData);
  } else {
    this.attrs[idx] = attrData;
  }
};

/**
 * Token.attrGet(name)
 *
 * Get the value of attribute `name`, or null if it does not exist.
 **/
Token.prototype.attrGet = function attrGet (name) {
  const idx = this.attrIndex(name);
  let value = null;
  if (idx >= 0) {
    value = this.attrs[idx][1];
  }
  return value
};

/**
 * Token.attrJoin(name, value)
 *
 * Join value to existing attribute via space. Or create new attribute if not
 * exists. Useful to operate with token classes.
 **/
Token.prototype.attrJoin = function attrJoin (name, value) {
  const idx = this.attrIndex(name);

  if (idx < 0) {
    this.attrPush([name, value]);
  } else {
    this.attrs[idx][1] = this.attrs[idx][1] + ' ' + value;
  }
};

// Core state object
//


function StateCore (src, md, env) {
  this.src = src;
  this.env = env;
  this.tokens = [];
  this.inlineMode = false;
  this.md = md; // link to parser instance
}

// re-export Token class to use in core rules
StateCore.prototype.Token = Token;

// Normalize input string

// https://spec.commonmark.org/0.29/#line-ending
const NEWLINES_RE  = /\r\n?|\n/g;
const NULL_RE      = /\0/g;

function normalize (state) {
  let str;

  // Normalize newlines
  str = state.src.replace(NEWLINES_RE, '\n');

  // Replace NULL characters
  str = str.replace(NULL_RE, '\uFFFD');

  state.src = str;
}

function block (state) {
  let token;

  if (state.inlineMode) {
    token          = new state.Token('inline', '', 0);
    token.content  = state.src;
    token.map      = [0, 1];
    token.children = [];
    state.tokens.push(token);
  } else {
    state.md.block.parse(state.src, state.md, state.env, state.tokens);
  }
}

function inline (state) {
  const tokens = state.tokens;

  // Parse inlines
  for (let i = 0, l = tokens.length; i < l; i++) {
    const tok = tokens[i];
    if (tok.type === 'inline') {
      state.md.inline.parse(tok.content, state.md, state.env, tok.children);
    }
  }
}

// Replace link-like texts with link nodes.
//
// Currently restricted by `md.validateLink()` to http/https/ftp
//


function isLinkOpen$1 (str) {
  return /^<a[>\s]/i.test(str)
}
function isLinkClose$1 (str) {
  return /^<\/a\s*>/i.test(str)
}

function linkify$1 (state) {
  const blockTokens = state.tokens;

  if (!state.md.options.linkify) { return }

  for (let j = 0, l = blockTokens.length; j < l; j++) {
    if (blockTokens[j].type !== 'inline' ||
        !state.md.linkify.pretest(blockTokens[j].content)) {
      continue
    }

    let tokens = blockTokens[j].children;

    let htmlLinkLevel = 0;

    // We scan from the end, to keep position when new tags added.
    // Use reversed logic in links start/end match
    for (let i = tokens.length - 1; i >= 0; i--) {
      const currentToken = tokens[i];

      // Skip content of markdown links
      if (currentToken.type === 'link_close') {
        i--;
        while (tokens[i].level !== currentToken.level && tokens[i].type !== 'link_open') {
          i--;
        }
        continue
      }

      // Skip content of html tag links
      if (currentToken.type === 'html_inline') {
        if (isLinkOpen$1(currentToken.content) && htmlLinkLevel > 0) {
          htmlLinkLevel--;
        }
        if (isLinkClose$1(currentToken.content)) {
          htmlLinkLevel++;
        }
      }
      if (htmlLinkLevel > 0) { continue }

      if (currentToken.type === 'text' && state.md.linkify.test(currentToken.content)) {
        const text = currentToken.content;
        let links = state.md.linkify.match(text);

        // Now split string to nodes
        const nodes = [];
        let level = currentToken.level;
        let lastPos = 0;

        // forbid escape sequence at the start of the string,
        // this avoids http\://example.com/ from being linkified as
        // http:<a href="//example.com/">//example.com/</a>
        if (links.length > 0 &&
            links[0].index === 0 &&
            i > 0 &&
            tokens[i - 1].type === 'text_special') {
          links = links.slice(1);
        }

        for (let ln = 0; ln < links.length; ln++) {
          const url = links[ln].url;
          const fullUrl = state.md.normalizeLink(url);
          if (!state.md.validateLink(fullUrl)) { continue }

          let urlText = links[ln].text;

          // Linkifier might send raw hostnames like "example.com", where url
          // starts with domain name. So we prepend http:// in those cases,
          // and remove it afterwards.
          //
          if (!links[ln].schema) {
            urlText = state.md.normalizeLinkText('http://' + urlText).replace(/^http:\/\//, '');
          } else if (links[ln].schema === 'mailto:' && !/^mailto:/i.test(urlText)) {
            urlText = state.md.normalizeLinkText('mailto:' + urlText).replace(/^mailto:/, '');
          } else {
            urlText = state.md.normalizeLinkText(urlText);
          }

          const pos = links[ln].index;

          if (pos > lastPos) {
            const token   = new state.Token('text', '', 0);
            token.content = text.slice(lastPos, pos);
            token.level   = level;
            nodes.push(token);
          }

          const token_o   = new state.Token('link_open', 'a', 1);
          token_o.attrs   = [['href', fullUrl]];
          token_o.level   = level++;
          token_o.markup  = 'linkify';
          token_o.info    = 'auto';
          nodes.push(token_o);

          const token_t   = new state.Token('text', '', 0);
          token_t.content = urlText;
          token_t.level   = level;
          nodes.push(token_t);

          const token_c   = new state.Token('link_close', 'a', -1);
          token_c.level   = --level;
          token_c.markup  = 'linkify';
          token_c.info    = 'auto';
          nodes.push(token_c);

          lastPos = links[ln].lastIndex;
        }
        if (lastPos < text.length) {
          const token   = new state.Token('text', '', 0);
          token.content = text.slice(lastPos);
          token.level   = level;
          nodes.push(token);
        }

        // replace current node
        blockTokens[j].children = tokens = arrayReplaceAt(tokens, i, nodes);
      }
    }
  }
}

// Simple typographic replacements
//
// (c) (C) → ©
// (tm) (TM) → ™
// (r) (R) → ®
// +- → ±
// ... → … (also ?.... → ?.., !.... → !..)
// ???????? → ???, !!!!! → !!!, `,,` → `,`
// -- → &ndash;, --- → &mdash;
//

// TODO:
// - fractionals 1/2, 1/4, 3/4 -> ½, ¼, ¾
// - multiplications 2 x 4 -> 2 × 4

const RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/;

// Workaround for phantomjs - need regex without /g flag,
// or root check will fail every second time
const SCOPED_ABBR_TEST_RE = /\((c|tm|r)\)/i;

const SCOPED_ABBR_RE = /\((c|tm|r)\)/ig;
const SCOPED_ABBR = {
  c: '©',
  r: '®',
  tm: '™'
};

function replaceFn (match, name) {
  return SCOPED_ABBR[name.toLowerCase()]
}

function replace_scoped (inlineTokens) {
  let inside_autolink = 0;

  for (let i = inlineTokens.length - 1; i >= 0; i--) {
    const token = inlineTokens[i];

    if (token.type === 'text' && !inside_autolink) {
      token.content = token.content.replace(SCOPED_ABBR_RE, replaceFn);
    }

    if (token.type === 'link_open' && token.info === 'auto') {
      inside_autolink--;
    }

    if (token.type === 'link_close' && token.info === 'auto') {
      inside_autolink++;
    }
  }
}

function replace_rare (inlineTokens) {
  let inside_autolink = 0;

  for (let i = inlineTokens.length - 1; i >= 0; i--) {
    const token = inlineTokens[i];

    if (token.type === 'text' && !inside_autolink) {
      if (RARE_RE.test(token.content)) {
        token.content = token.content
          .replace(/\+-/g, '±')
          // .., ..., ....... -> …
          // but ?..... & !..... -> ?.. & !..
          .replace(/\.{2,}/g, '…').replace(/([?!])…/g, '$1..')
          .replace(/([?!]){4,}/g, '$1$1$1').replace(/,{2,}/g, ',')
          // em-dash
          .replace(/(^|[^-])---(?=[^-]|$)/mg, '$1\u2014')
          // en-dash
          .replace(/(^|\s)--(?=\s|$)/mg, '$1\u2013')
          .replace(/(^|[^-\s])--(?=[^-\s]|$)/mg, '$1\u2013');
      }
    }

    if (token.type === 'link_open' && token.info === 'auto') {
      inside_autolink--;
    }

    if (token.type === 'link_close' && token.info === 'auto') {
      inside_autolink++;
    }
  }
}

function replace (state) {
  let blkIdx;

  if (!state.md.options.typographer) { return }

  for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
    if (state.tokens[blkIdx].type !== 'inline') { continue }

    if (SCOPED_ABBR_TEST_RE.test(state.tokens[blkIdx].content)) {
      replace_scoped(state.tokens[blkIdx].children);
    }

    if (RARE_RE.test(state.tokens[blkIdx].content)) {
      replace_rare(state.tokens[blkIdx].children);
    }
  }
}

// Convert straight quotation marks to typographic ones
//


const QUOTE_TEST_RE = /['"]/;
const QUOTE_RE = /['"]/g;
const APOSTROPHE = '\u2019'; /* ’ */

function replaceAt (str, index, ch) {
  return str.slice(0, index) + ch + str.slice(index + 1)
}

function process_inlines (tokens, state) {
  let j;

  const stack = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    const thisLevel = tokens[i].level;

    for (j = stack.length - 1; j >= 0; j--) {
      if (stack[j].level <= thisLevel) { break }
    }
    stack.length = j + 1;

    if (token.type !== 'text') { continue }

    let text = token.content;
    let pos = 0;
    let max = text.length;

    /* eslint no-labels:0,block-scoped-var:0 */
    OUTER:
    while (pos < max) {
      QUOTE_RE.lastIndex = pos;
      const t = QUOTE_RE.exec(text);
      if (!t) { break }

      let canOpen = true;
      let canClose = true;
      pos = t.index + 1;
      const isSingle = (t[0] === "'");

      // Find previous character,
      // default to space if it's the beginning of the line
      //
      let lastChar = 0x20;

      if (t.index - 1 >= 0) {
        lastChar = text.charCodeAt(t.index - 1);
      } else {
        for (j = i - 1; j >= 0; j--) {
          if (tokens[j].type === 'softbreak' || tokens[j].type === 'hardbreak') break // lastChar defaults to 0x20
          if (!tokens[j].content) continue // should skip all tokens except 'text', 'html_inline' or 'code_inline'

          lastChar = tokens[j].content.charCodeAt(tokens[j].content.length - 1);
          break
        }
      }

      // Find next character,
      // default to space if it's the end of the line
      //
      let nextChar = 0x20;

      if (pos < max) {
        nextChar = text.charCodeAt(pos);
      } else {
        for (j = i + 1; j < tokens.length; j++) {
          if (tokens[j].type === 'softbreak' || tokens[j].type === 'hardbreak') break // nextChar defaults to 0x20
          if (!tokens[j].content) continue // should skip all tokens except 'text', 'html_inline' or 'code_inline'

          nextChar = tokens[j].content.charCodeAt(0);
          break
        }
      }

      const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar));
      const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar));

      const isLastWhiteSpace = isWhiteSpace(lastChar);
      const isNextWhiteSpace = isWhiteSpace(nextChar);

      if (isNextWhiteSpace) {
        canOpen = false;
      } else if (isNextPunctChar) {
        if (!(isLastWhiteSpace || isLastPunctChar)) {
          canOpen = false;
        }
      }

      if (isLastWhiteSpace) {
        canClose = false;
      } else if (isLastPunctChar) {
        if (!(isNextWhiteSpace || isNextPunctChar)) {
          canClose = false;
        }
      }

      if (nextChar === 0x22 /* " */ && t[0] === '"') {
        if (lastChar >= 0x30 /* 0 */ && lastChar <= 0x39 /* 9 */) {
          // special case: 1"" - count first quote as an inch
          canClose = canOpen = false;
        }
      }

      if (canOpen && canClose) {
        // Replace quotes in the middle of punctuation sequence, but not
        // in the middle of the words, i.e.:
        //
        // 1. foo " bar " baz - not replaced
        // 2. foo-"-bar-"-baz - replaced
        // 3. foo"bar"baz     - not replaced
        //
        canOpen = isLastPunctChar;
        canClose = isNextPunctChar;
      }

      if (!canOpen && !canClose) {
        // middle of word
        if (isSingle) {
          token.content = replaceAt(token.content, t.index, APOSTROPHE);
        }
        continue
      }

      if (canClose) {
        // this could be a closing quote, rewind the stack to get a match
        for (j = stack.length - 1; j >= 0; j--) {
          let item = stack[j];
          if (stack[j].level < thisLevel) { break }
          if (item.single === isSingle && stack[j].level === thisLevel) {
            item = stack[j];

            let openQuote;
            let closeQuote;
            if (isSingle) {
              openQuote = state.md.options.quotes[2];
              closeQuote = state.md.options.quotes[3];
            } else {
              openQuote = state.md.options.quotes[0];
              closeQuote = state.md.options.quotes[1];
            }

            // replace token.content *before* tokens[item.token].content,
            // because, if they are pointing at the same token, replaceAt
            // could mess up indices when quote length != 1
            token.content = replaceAt(token.content, t.index, closeQuote);
            tokens[item.token].content = replaceAt(
              tokens[item.token].content, item.pos, openQuote);

            pos += closeQuote.length - 1;
            if (item.token === i) { pos += openQuote.length - 1; }

            text = token.content;
            max = text.length;

            stack.length = j;
            continue OUTER
          }
        }
      }

      if (canOpen) {
        stack.push({
          token: i,
          pos: t.index,
          single: isSingle,
          level: thisLevel
        });
      } else if (canClose && isSingle) {
        token.content = replaceAt(token.content, t.index, APOSTROPHE);
      }
    }
  }
}

function smartquotes (state) {
  /* eslint max-depth:0 */
  if (!state.md.options.typographer) { return }

  for (let blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
    if (state.tokens[blkIdx].type !== 'inline' ||
        !QUOTE_TEST_RE.test(state.tokens[blkIdx].content)) {
      continue
    }

    process_inlines(state.tokens[blkIdx].children, state);
  }
}

// Join raw text tokens with the rest of the text
//
// This is set as a separate rule to provide an opportunity for plugins
// to run text replacements after text join, but before escape join.
//
// For example, `\:)` shouldn't be replaced with an emoji.
//

function text_join (state) {
  let curr, last;
  const blockTokens = state.tokens;
  const l = blockTokens.length;

  for (let j = 0; j < l; j++) {
    if (blockTokens[j].type !== 'inline') continue

    const tokens = blockTokens[j].children;
    const max = tokens.length;

    for (curr = 0; curr < max; curr++) {
      if (tokens[curr].type === 'text_special') {
        tokens[curr].type = 'text';
      }
    }

    for (curr = last = 0; curr < max; curr++) {
      if (tokens[curr].type === 'text' &&
          curr + 1 < max &&
          tokens[curr + 1].type === 'text') {
        // collapse two adjacent text nodes
        tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
      } else {
        if (curr !== last) { tokens[last] = tokens[curr]; }

        last++;
      }
    }

    if (curr !== last) {
      tokens.length = last;
    }
  }
}

/** internal
 * class Core
 *
 * Top-level rules executor. Glues block/inline parsers and does intermediate
 * transformations.
 **/


const _rules$2 = [
  ['normalize',      normalize],
  ['block',          block],
  ['inline',         inline],
  ['linkify',        linkify$1],
  ['replacements',   replace],
  ['smartquotes',    smartquotes],
  // `text_join` finds `text_special` tokens (for escape sequences)
  // and joins them with the rest of the text
  ['text_join',      text_join]
];

/**
 * new Core()
 **/
function Core () {
  /**
   * Core#ruler -> Ruler
   *
   * [[Ruler]] instance. Keep configuration of core rules.
   **/
  this.ruler = new Ruler();

  for (let i = 0; i < _rules$2.length; i++) {
    this.ruler.push(_rules$2[i][0], _rules$2[i][1]);
  }
}

/**
 * Core.process(state)
 *
 * Executes core chain rules.
 **/
Core.prototype.process = function (state) {
  const rules = this.ruler.getRules('');

  for (let i = 0, l = rules.length; i < l; i++) {
    rules[i](state);
  }
};

Core.prototype.State = StateCore;

// Parser state class


function StateBlock (src, md, env, tokens) {
  this.src = src;

  // link to parser instance
  this.md     = md;

  this.env = env;

  //
  // Internal state vartiables
  //

  this.tokens = tokens;

  this.bMarks = [];  // line begin offsets for fast jumps
  this.eMarks = [];  // line end offsets for fast jumps
  this.tShift = [];  // offsets of the first non-space characters (tabs not expanded)
  this.sCount = [];  // indents for each line (tabs expanded)

  // An amount of virtual spaces (tabs expanded) between beginning
  // of each line (bMarks) and real beginning of that line.
  //
  // It exists only as a hack because blockquotes override bMarks
  // losing information in the process.
  //
  // It's used only when expanding tabs, you can think about it as
  // an initial tab length, e.g. bsCount=21 applied to string `\t123`
  // means first tab should be expanded to 4-21%4 === 3 spaces.
  //
  this.bsCount = [];

  // block parser variables

  // required block content indent (for example, if we are
  // inside a list, it would be positioned after list marker)
  this.blkIndent  = 0;
  this.line       = 0; // line index in src
  this.lineMax    = 0; // lines count
  this.tight      = false;  // loose/tight mode for lists
  this.ddIndent   = -1; // indent of the current dd block (-1 if there isn't any)
  this.listIndent = -1; // indent of the current list block (-1 if there isn't any)

  // can be 'blockquote', 'list', 'root', 'paragraph' or 'reference'
  // used in lists to determine if they interrupt a paragraph
  this.parentType = 'root';

  this.level = 0;

  // Create caches
  // Generate markers.
  const s = this.src;

  for (let start = 0, pos = 0, indent = 0, offset = 0, len = s.length, indent_found = false; pos < len; pos++) {
    const ch = s.charCodeAt(pos);

    if (!indent_found) {
      if (isSpace(ch)) {
        indent++;

        if (ch === 0x09) {
          offset += 4 - offset % 4;
        } else {
          offset++;
        }
        continue
      } else {
        indent_found = true;
      }
    }

    if (ch === 0x0A || pos === len - 1) {
      if (ch !== 0x0A) { pos++; }
      this.bMarks.push(start);
      this.eMarks.push(pos);
      this.tShift.push(indent);
      this.sCount.push(offset);
      this.bsCount.push(0);

      indent_found = false;
      indent = 0;
      offset = 0;
      start = pos + 1;
    }
  }

  // Push fake entry to simplify cache bounds checks
  this.bMarks.push(s.length);
  this.eMarks.push(s.length);
  this.tShift.push(0);
  this.sCount.push(0);
  this.bsCount.push(0);

  this.lineMax = this.bMarks.length - 1; // don't count last fake line
}

// Push new token to "stream".
//
StateBlock.prototype.push = function (type, tag, nesting) {
  const token = new Token(type, tag, nesting);
  token.block = true;

  if (nesting < 0) this.level--; // closing tag
  token.level = this.level;
  if (nesting > 0) this.level++; // opening tag

  this.tokens.push(token);
  return token
};

StateBlock.prototype.isEmpty = function isEmpty (line) {
  return this.bMarks[line] + this.tShift[line] >= this.eMarks[line]
};

StateBlock.prototype.skipEmptyLines = function skipEmptyLines (from) {
  for (let max = this.lineMax; from < max; from++) {
    if (this.bMarks[from] + this.tShift[from] < this.eMarks[from]) {
      break
    }
  }
  return from
};

// Skip spaces from given position.
StateBlock.prototype.skipSpaces = function skipSpaces (pos) {
  for (let max = this.src.length; pos < max; pos++) {
    const ch = this.src.charCodeAt(pos);
    if (!isSpace(ch)) { break }
  }
  return pos
};

// Skip spaces from given position in reverse.
StateBlock.prototype.skipSpacesBack = function skipSpacesBack (pos, min) {
  if (pos <= min) { return pos }

  while (pos > min) {
    if (!isSpace(this.src.charCodeAt(--pos))) { return pos + 1 }
  }
  return pos
};

// Skip char codes from given position
StateBlock.prototype.skipChars = function skipChars (pos, code) {
  for (let max = this.src.length; pos < max; pos++) {
    if (this.src.charCodeAt(pos) !== code) { break }
  }
  return pos
};

// Skip char codes reverse from given position - 1
StateBlock.prototype.skipCharsBack = function skipCharsBack (pos, code, min) {
  if (pos <= min) { return pos }

  while (pos > min) {
    if (code !== this.src.charCodeAt(--pos)) { return pos + 1 }
  }
  return pos
};

// cut lines range from source.
StateBlock.prototype.getLines = function getLines (begin, end, indent, keepLastLF) {
  if (begin >= end) {
    return ''
  }

  const queue = new Array(end - begin);

  for (let i = 0, line = begin; line < end; line++, i++) {
    let lineIndent = 0;
    const lineStart = this.bMarks[line];
    let first = lineStart;
    let last;

    if (line + 1 < end || keepLastLF) {
      // No need for bounds check because we have fake entry on tail.
      last = this.eMarks[line] + 1;
    } else {
      last = this.eMarks[line];
    }

    while (first < last && lineIndent < indent) {
      const ch = this.src.charCodeAt(first);

      if (isSpace(ch)) {
        if (ch === 0x09) {
          lineIndent += 4 - (lineIndent + this.bsCount[line]) % 4;
        } else {
          lineIndent++;
        }
      } else if (first - lineStart < this.tShift[line]) {
        // patched tShift masked characters to look like spaces (blockquotes, list markers)
        lineIndent++;
      } else {
        break
      }

      first++;
    }

    if (lineIndent > indent) {
      // partially expanding tabs in code blocks, e.g '\t\tfoobar'
      // with indent=2 becomes '  \tfoobar'
      queue[i] = new Array(lineIndent - indent + 1).join(' ') + this.src.slice(first, last);
    } else {
      queue[i] = this.src.slice(first, last);
    }
  }

  return queue.join('')
};

// re-export Token class to use in block rules
StateBlock.prototype.Token = Token;

// GFM table, https://github.github.com/gfm/#tables-extension-


// Limit the amount of empty autocompleted cells in a table,
// see https://github.com/markdown-it/markdown-it/issues/1000,
//
// Both pulldown-cmark and commonmark-hs limit the number of cells this way to ~200k.
// We set it to 65k, which can expand user input by a factor of x370
// (256x256 square is 1.8kB expanded into 650kB).
const MAX_AUTOCOMPLETED_CELLS = 0x10000;

function getLine (state, line) {
  const pos = state.bMarks[line] + state.tShift[line];
  const max = state.eMarks[line];

  return state.src.slice(pos, max)
}

function escapedSplit (str) {
  const result = [];
  const max = str.length;

  let pos = 0;
  let ch = str.charCodeAt(pos);
  let isEscaped = false;
  let lastPos = 0;
  let current = '';

  while (pos < max) {
    if (ch === 0x7c/* | */) {
      if (!isEscaped) {
        // pipe separating cells, '|'
        result.push(current + str.substring(lastPos, pos));
        current = '';
        lastPos = pos + 1;
      } else {
        // escaped pipe, '\|'
        current += str.substring(lastPos, pos - 1);
        lastPos = pos;
      }
    }

    isEscaped = (ch === 0x5c/* \ */);
    pos++;

    ch = str.charCodeAt(pos);
  }

  result.push(current + str.substring(lastPos));

  return result
}

function table (state, startLine, endLine, silent) {
  // should have at least two lines
  if (startLine + 2 > endLine) { return false }

  let nextLine = startLine + 1;

  if (state.sCount[nextLine] < state.blkIndent) { return false }

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[nextLine] - state.blkIndent >= 4) { return false }

  // first character of the second line should be '|', '-', ':',
  // and no other characters are allowed but spaces;
  // basically, this is the equivalent of /^[-:|][-:|\s]*$/ regexp

  let pos = state.bMarks[nextLine] + state.tShift[nextLine];
  if (pos >= state.eMarks[nextLine]) { return false }

  const firstCh = state.src.charCodeAt(pos++);
  if (firstCh !== 0x7C/* | */ && firstCh !== 0x2D/* - */ && firstCh !== 0x3A/* : */) { return false }

  if (pos >= state.eMarks[nextLine]) { return false }

  const secondCh = state.src.charCodeAt(pos++);
  if (secondCh !== 0x7C/* | */ && secondCh !== 0x2D/* - */ && secondCh !== 0x3A/* : */ && !isSpace(secondCh)) {
    return false
  }

  // if first character is '-', then second character must not be a space
  // (due to parsing ambiguity with list)
  if (firstCh === 0x2D/* - */ && isSpace(secondCh)) { return false }

  while (pos < state.eMarks[nextLine]) {
    const ch = state.src.charCodeAt(pos);

    if (ch !== 0x7C/* | */ && ch !== 0x2D/* - */ && ch !== 0x3A/* : */ && !isSpace(ch)) { return false }

    pos++;
  }

  let lineText = getLine(state, startLine + 1);
  let columns = lineText.split('|');
  const aligns = [];
  for (let i = 0; i < columns.length; i++) {
    const t = columns[i].trim();
    if (!t) {
      // allow empty columns before and after table, but not in between columns;
      // e.g. allow ` |---| `, disallow ` ---||--- `
      if (i === 0 || i === columns.length - 1) {
        continue
      } else {
        return false
      }
    }

    if (!/^:?-+:?$/.test(t)) { return false }
    if (t.charCodeAt(t.length - 1) === 0x3A/* : */) {
      aligns.push(t.charCodeAt(0) === 0x3A/* : */ ? 'center' : 'right');
    } else if (t.charCodeAt(0) === 0x3A/* : */) {
      aligns.push('left');
    } else {
      aligns.push('');
    }
  }

  lineText = getLine(state, startLine).trim();
  if (lineText.indexOf('|') === -1) { return false }
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }
  columns = escapedSplit(lineText);
  if (columns.length && columns[0] === '') columns.shift();
  if (columns.length && columns[columns.length - 1] === '') columns.pop();

  // header row will define an amount of columns in the entire table,
  // and align row should be exactly the same (the rest of the rows can differ)
  const columnCount = columns.length;
  if (columnCount === 0 || columnCount !== aligns.length) { return false }

  if (silent) { return true }

  const oldParentType = state.parentType;
  state.parentType = 'table';

  // use 'blockquote' lists for termination because it's
  // the most similar to tables
  const terminatorRules = state.md.block.ruler.getRules('blockquote');

  const token_to = state.push('table_open', 'table', 1);
  const tableLines = [startLine, 0];
  token_to.map = tableLines;

  const token_tho = state.push('thead_open', 'thead', 1);
  token_tho.map = [startLine, startLine + 1];

  const token_htro = state.push('tr_open', 'tr', 1);
  token_htro.map = [startLine, startLine + 1];

  for (let i = 0; i < columns.length; i++) {
    const token_ho = state.push('th_open', 'th', 1);
    if (aligns[i]) {
      token_ho.attrs  = [['style', 'text-align:' + aligns[i]]];
    }

    const token_il = state.push('inline', '', 0);
    token_il.content  = columns[i].trim();
    token_il.children = [];

    state.push('th_close', 'th', -1);
  }

  state.push('tr_close', 'tr', -1);
  state.push('thead_close', 'thead', -1);

  let tbodyLines;
  let autocompletedCells = 0;

  for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
    if (state.sCount[nextLine] < state.blkIndent) { break }

    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break
      }
    }

    if (terminate) { break }
    lineText = getLine(state, nextLine).trim();
    if (!lineText) { break }
    if (state.sCount[nextLine] - state.blkIndent >= 4) { break }
    columns = escapedSplit(lineText);
    if (columns.length && columns[0] === '') columns.shift();
    if (columns.length && columns[columns.length - 1] === '') columns.pop();

    // note: autocomplete count can be negative if user specifies more columns than header,
    // but that does not affect intended use (which is limiting expansion)
    autocompletedCells += columnCount - columns.length;
    if (autocompletedCells > MAX_AUTOCOMPLETED_CELLS) { break }

    if (nextLine === startLine + 2) {
      const token_tbo = state.push('tbody_open', 'tbody', 1);
      token_tbo.map = tbodyLines = [startLine + 2, 0];
    }

    const token_tro = state.push('tr_open', 'tr', 1);
    token_tro.map = [nextLine, nextLine + 1];

    for (let i = 0; i < columnCount; i++) {
      const token_tdo = state.push('td_open', 'td', 1);
      if (aligns[i]) {
        token_tdo.attrs  = [['style', 'text-align:' + aligns[i]]];
      }

      const token_il = state.push('inline', '', 0);
      token_il.content  = columns[i] ? columns[i].trim() : '';
      token_il.children = [];

      state.push('td_close', 'td', -1);
    }
    state.push('tr_close', 'tr', -1);
  }

  if (tbodyLines) {
    state.push('tbody_close', 'tbody', -1);
    tbodyLines[1] = nextLine;
  }

  state.push('table_close', 'table', -1);
  tableLines[1] = nextLine;

  state.parentType = oldParentType;
  state.line = nextLine;
  return true
}

// Code block (4 spaces padded)

function code (state, startLine, endLine/*, silent */) {
  if (state.sCount[startLine] - state.blkIndent < 4) { return false }

  let nextLine = startLine + 1;
  let last = nextLine;

  while (nextLine < endLine) {
    if (state.isEmpty(nextLine)) {
      nextLine++;
      continue
    }

    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      nextLine++;
      last = nextLine;
      continue
    }
    break
  }

  state.line = last;

  const token   = state.push('code_block', 'code', 0);
  token.content = state.getLines(startLine, last, 4 + state.blkIndent, false) + '\n';
  token.map     = [startLine, state.line];

  return true
}

// fences (``` lang, ~~~ lang)

function fence (state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  if (pos + 3 > max) { return false }

  const marker = state.src.charCodeAt(pos);

  if (marker !== 0x7E/* ~ */ && marker !== 0x60 /* ` */) {
    return false
  }

  // scan marker length
  let mem = pos;
  pos = state.skipChars(pos, marker);

  let len = pos - mem;

  if (len < 3) { return false }

  const markup = state.src.slice(mem, pos);
  const params = state.src.slice(pos, max);

  if (marker === 0x60 /* ` */) {
    if (params.indexOf(String.fromCharCode(marker)) >= 0) {
      return false
    }
  }

  // Since start is found, we can report success here in validation mode
  if (silent) { return true }

  // search end of block
  let nextLine = startLine;
  let haveEndMarker = false;

  for (;;) {
    nextLine++;
    if (nextLine >= endLine) {
      // unclosed block should be autoclosed by end of document.
      // also block seems to be autoclosed by end of parent
      break
    }

    pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];

    if (pos < max && state.sCount[nextLine] < state.blkIndent) {
      // non-empty line with negative indent should stop the list:
      // - ```
      //  test
      break
    }

    if (state.src.charCodeAt(pos) !== marker) { continue }

    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      // closing fence should be indented less than 4 spaces
      continue
    }

    pos = state.skipChars(pos, marker);

    // closing code fence must be at least as long as the opening one
    if (pos - mem < len) { continue }

    // make sure tail has spaces only
    pos = state.skipSpaces(pos);

    if (pos < max) { continue }

    haveEndMarker = true;
    // found!
    break
  }

  // If a fence has heading spaces, they should be removed from its inner block
  len = state.sCount[startLine];

  state.line = nextLine + (haveEndMarker ? 1 : 0);

  const token   = state.push('fence', 'code', 0);
  token.info    = params;
  token.content = state.getLines(startLine + 1, nextLine, len, true);
  token.markup  = markup;
  token.map     = [startLine, state.line];

  return true
}

// Block quotes


function blockquote (state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];

  const oldLineMax = state.lineMax;

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  // check the block quote marker
  if (state.src.charCodeAt(pos) !== 0x3E/* > */) { return false }

  // we know that it's going to be a valid blockquote,
  // so no point trying to find the end of it in silent mode
  if (silent) { return true }

  const oldBMarks  = [];
  const oldBSCount = [];
  const oldSCount  = [];
  const oldTShift  = [];

  const terminatorRules = state.md.block.ruler.getRules('blockquote');

  const oldParentType = state.parentType;
  state.parentType = 'blockquote';
  let lastLineEmpty = false;
  let nextLine;

  // Search the end of the block
  //
  // Block ends with either:
  //  1. an empty line outside:
  //     ```
  //     > test
  //
  //     ```
  //  2. an empty line inside:
  //     ```
  //     >
  //     test
  //     ```
  //  3. another tag:
  //     ```
  //     > test
  //      - - -
  //     ```
  for (nextLine = startLine; nextLine < endLine; nextLine++) {
    // check if it's outdented, i.e. it's inside list item and indented
    // less than said list item:
    //
    // ```
    // 1. anything
    //    > current blockquote
    // 2. checking this line
    // ```
    const isOutdented = state.sCount[nextLine] < state.blkIndent;

    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];

    if (pos >= max) {
      // Case 1: line is not inside the blockquote, and this line is empty.
      break
    }

    if (state.src.charCodeAt(pos++) === 0x3E/* > */ && !isOutdented) {
      // This line is inside the blockquote.

      // set offset past spaces and ">"
      let initial = state.sCount[nextLine] + 1;
      let spaceAfterMarker;
      let adjustTab;

      // skip one optional space after '>'
      if (state.src.charCodeAt(pos) === 0x20 /* space */) {
        // ' >   test '
        //     ^ -- position start of line here:
        pos++;
        initial++;
        adjustTab = false;
        spaceAfterMarker = true;
      } else if (state.src.charCodeAt(pos) === 0x09 /* tab */) {
        spaceAfterMarker = true;

        if ((state.bsCount[nextLine] + initial) % 4 === 3) {
          // '  >\t  test '
          //       ^ -- position start of line here (tab has width===1)
          pos++;
          initial++;
          adjustTab = false;
        } else {
          // ' >\t  test '
          //    ^ -- position start of line here + shift bsCount slightly
          //         to make extra space appear
          adjustTab = true;
        }
      } else {
        spaceAfterMarker = false;
      }

      let offset = initial;
      oldBMarks.push(state.bMarks[nextLine]);
      state.bMarks[nextLine] = pos;

      while (pos < max) {
        const ch = state.src.charCodeAt(pos);

        if (isSpace(ch)) {
          if (ch === 0x09) {
            offset += 4 - (offset + state.bsCount[nextLine] + (adjustTab ? 1 : 0)) % 4;
          } else {
            offset++;
          }
        } else {
          break
        }

        pos++;
      }

      lastLineEmpty = pos >= max;

      oldBSCount.push(state.bsCount[nextLine]);
      state.bsCount[nextLine] = state.sCount[nextLine] + 1 + (spaceAfterMarker ? 1 : 0);

      oldSCount.push(state.sCount[nextLine]);
      state.sCount[nextLine] = offset - initial;

      oldTShift.push(state.tShift[nextLine]);
      state.tShift[nextLine] = pos - state.bMarks[nextLine];
      continue
    }

    // Case 2: line is not inside the blockquote, and the last line was empty.
    if (lastLineEmpty) { break }

    // Case 3: another tag found.
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break
      }
    }

    if (terminate) {
      // Quirk to enforce "hard termination mode" for paragraphs;
      // normally if you call `tokenize(state, startLine, nextLine)`,
      // paragraphs will look below nextLine for paragraph continuation,
      // but if blockquote is terminated by another tag, they shouldn't
      state.lineMax = nextLine;

      if (state.blkIndent !== 0) {
        // state.blkIndent was non-zero, we now set it to zero,
        // so we need to re-calculate all offsets to appear as
        // if indent wasn't changed
        oldBMarks.push(state.bMarks[nextLine]);
        oldBSCount.push(state.bsCount[nextLine]);
        oldTShift.push(state.tShift[nextLine]);
        oldSCount.push(state.sCount[nextLine]);
        state.sCount[nextLine] -= state.blkIndent;
      }

      break
    }

    oldBMarks.push(state.bMarks[nextLine]);
    oldBSCount.push(state.bsCount[nextLine]);
    oldTShift.push(state.tShift[nextLine]);
    oldSCount.push(state.sCount[nextLine]);

    // A negative indentation means that this is a paragraph continuation
    //
    state.sCount[nextLine] = -1;
  }

  const oldIndent = state.blkIndent;
  state.blkIndent = 0;

  const token_o  = state.push('blockquote_open', 'blockquote', 1);
  token_o.markup = '>';
  const lines = [startLine, 0];
  token_o.map    = lines;

  state.md.block.tokenize(state, startLine, nextLine);

  const token_c  = state.push('blockquote_close', 'blockquote', -1);
  token_c.markup = '>';

  state.lineMax = oldLineMax;
  state.parentType = oldParentType;
  lines[1] = state.line;

  // Restore original tShift; this might not be necessary since the parser
  // has already been here, but just to make sure we can do that.
  for (let i = 0; i < oldTShift.length; i++) {
    state.bMarks[i + startLine] = oldBMarks[i];
    state.tShift[i + startLine] = oldTShift[i];
    state.sCount[i + startLine] = oldSCount[i];
    state.bsCount[i + startLine] = oldBSCount[i];
  }
  state.blkIndent = oldIndent;

  return true
}

// Horizontal rule


function hr (state, startLine, endLine, silent) {
  const max = state.eMarks[startLine];
  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  let pos = state.bMarks[startLine] + state.tShift[startLine];
  const marker = state.src.charCodeAt(pos++);

  // Check hr marker
  if (marker !== 0x2A/* * */ &&
      marker !== 0x2D/* - */ &&
      marker !== 0x5F/* _ */) {
    return false
  }

  // markers can be mixed with spaces, but there should be at least 3 of them

  let cnt = 1;
  while (pos < max) {
    const ch = state.src.charCodeAt(pos++);
    if (ch !== marker && !isSpace(ch)) { return false }
    if (ch === marker) { cnt++; }
  }

  if (cnt < 3) { return false }

  if (silent) { return true }

  state.line = startLine + 1;

  const token  = state.push('hr', 'hr', 0);
  token.map    = [startLine, state.line];
  token.markup = Array(cnt + 1).join(String.fromCharCode(marker));

  return true
}

// Lists


// Search `[-+*][\n ]`, returns next pos after marker on success
// or -1 on fail.
function skipBulletListMarker (state, startLine) {
  const max = state.eMarks[startLine];
  let pos = state.bMarks[startLine] + state.tShift[startLine];

  const marker = state.src.charCodeAt(pos++);
  // Check bullet
  if (marker !== 0x2A/* * */ &&
      marker !== 0x2D/* - */ &&
      marker !== 0x2B/* + */) {
    return -1
  }

  if (pos < max) {
    const ch = state.src.charCodeAt(pos);

    if (!isSpace(ch)) {
      // " -test " - is not a list item
      return -1
    }
  }

  return pos
}

// Search `\d+[.)][\n ]`, returns next pos after marker on success
// or -1 on fail.
function skipOrderedListMarker (state, startLine) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  let pos = start;

  // List marker should have at least 2 chars (digit + dot)
  if (pos + 1 >= max) { return -1 }

  let ch = state.src.charCodeAt(pos++);

  if (ch < 0x30/* 0 */ || ch > 0x39/* 9 */) { return -1 }

  for (;;) {
    // EOL -> fail
    if (pos >= max) { return -1 }

    ch = state.src.charCodeAt(pos++);

    if (ch >= 0x30/* 0 */ && ch <= 0x39/* 9 */) {
      // List marker should have no more than 9 digits
      // (prevents integer overflow in browsers)
      if (pos - start >= 10) { return -1 }

      continue
    }

    // found valid marker
    if (ch === 0x29/* ) */ || ch === 0x2e/* . */) {
      break
    }

    return -1
  }

  if (pos < max) {
    ch = state.src.charCodeAt(pos);

    if (!isSpace(ch)) {
      // " 1.test " - is not a list item
      return -1
    }
  }
  return pos
}

function markTightParagraphs (state, idx) {
  const level = state.level + 2;

  for (let i = idx + 2, l = state.tokens.length - 2; i < l; i++) {
    if (state.tokens[i].level === level && state.tokens[i].type === 'paragraph_open') {
      state.tokens[i + 2].hidden = true;
      state.tokens[i].hidden = true;
      i += 2;
    }
  }
}

function list (state, startLine, endLine, silent) {
  let max, pos, start, token;
  let nextLine = startLine;
  let tight = true;

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[nextLine] - state.blkIndent >= 4) { return false }

  // Special case:
  //  - item 1
  //   - item 2
  //    - item 3
  //     - item 4
  //      - this one is a paragraph continuation
  if (state.listIndent >= 0 &&
      state.sCount[nextLine] - state.listIndent >= 4 &&
      state.sCount[nextLine] < state.blkIndent) {
    return false
  }

  let isTerminatingParagraph = false;

  // limit conditions when list can interrupt
  // a paragraph (validation mode only)
  if (silent && state.parentType === 'paragraph') {
    // Next list item should still terminate previous list item;
    //
    // This code can fail if plugins use blkIndent as well as lists,
    // but I hope the spec gets fixed long before that happens.
    //
    if (state.sCount[nextLine] >= state.blkIndent) {
      isTerminatingParagraph = true;
    }
  }

  // Detect list type and position after marker
  let isOrdered;
  let markerValue;
  let posAfterMarker;
  if ((posAfterMarker = skipOrderedListMarker(state, nextLine)) >= 0) {
    isOrdered = true;
    start = state.bMarks[nextLine] + state.tShift[nextLine];
    markerValue = Number(state.src.slice(start, posAfterMarker - 1));

    // If we're starting a new ordered list right after
    // a paragraph, it should start with 1.
    if (isTerminatingParagraph && markerValue !== 1) return false
  } else if ((posAfterMarker = skipBulletListMarker(state, nextLine)) >= 0) {
    isOrdered = false;
  } else {
    return false
  }

  // If we're starting a new unordered list right after
  // a paragraph, first line should not be empty.
  if (isTerminatingParagraph) {
    if (state.skipSpaces(posAfterMarker) >= state.eMarks[nextLine]) return false
  }

  // For validation mode we can terminate immediately
  if (silent) { return true }

  // We should terminate list on style change. Remember first one to compare.
  const markerCharCode = state.src.charCodeAt(posAfterMarker - 1);

  // Start list
  const listTokIdx = state.tokens.length;

  if (isOrdered) {
    token       = state.push('ordered_list_open', 'ol', 1);
    if (markerValue !== 1) {
      token.attrs = [['start', markerValue]];
    }
  } else {
    token       = state.push('bullet_list_open', 'ul', 1);
  }

  const listLines = [nextLine, 0];
  token.map    = listLines;
  token.markup = String.fromCharCode(markerCharCode);

  //
  // Iterate list items
  //

  let prevEmptyEnd = false;
  const terminatorRules = state.md.block.ruler.getRules('list');

  const oldParentType = state.parentType;
  state.parentType = 'list';

  while (nextLine < endLine) {
    pos = posAfterMarker;
    max = state.eMarks[nextLine];

    const initial = state.sCount[nextLine] + posAfterMarker - (state.bMarks[nextLine] + state.tShift[nextLine]);
    let offset = initial;

    while (pos < max) {
      const ch = state.src.charCodeAt(pos);

      if (ch === 0x09) {
        offset += 4 - (offset + state.bsCount[nextLine]) % 4;
      } else if (ch === 0x20) {
        offset++;
      } else {
        break
      }

      pos++;
    }

    const contentStart = pos;
    let indentAfterMarker;

    if (contentStart >= max) {
      // trimming space in "-    \n  3" case, indent is 1 here
      indentAfterMarker = 1;
    } else {
      indentAfterMarker = offset - initial;
    }

    // If we have more than 4 spaces, the indent is 1
    // (the rest is just indented code block)
    if (indentAfterMarker > 4) { indentAfterMarker = 1; }

    // "  -  test"
    //  ^^^^^ - calculating total length of this thing
    const indent = initial + indentAfterMarker;

    // Run subparser & write tokens
    token        = state.push('list_item_open', 'li', 1);
    token.markup = String.fromCharCode(markerCharCode);
    const itemLines = [nextLine, 0];
    token.map    = itemLines;
    if (isOrdered) {
      token.info = state.src.slice(start, posAfterMarker - 1);
    }

    // change current state, then restore it after parser subcall
    const oldTight = state.tight;
    const oldTShift = state.tShift[nextLine];
    const oldSCount = state.sCount[nextLine];

    //  - example list
    // ^ listIndent position will be here
    //   ^ blkIndent position will be here
    //
    const oldListIndent = state.listIndent;
    state.listIndent = state.blkIndent;
    state.blkIndent = indent;

    state.tight = true;
    state.tShift[nextLine] = contentStart - state.bMarks[nextLine];
    state.sCount[nextLine] = offset;

    if (contentStart >= max && state.isEmpty(nextLine + 1)) {
      // workaround for this case
      // (list item is empty, list terminates before "foo"):
      // ~~~~~~~~
      //   -
      //
      //     foo
      // ~~~~~~~~
      state.line = Math.min(state.line + 2, endLine);
    } else {
      state.md.block.tokenize(state, nextLine, endLine, true);
    }

    // If any of list item is tight, mark list as tight
    if (!state.tight || prevEmptyEnd) {
      tight = false;
    }
    // Item become loose if finish with empty line,
    // but we should filter last element, because it means list finish
    prevEmptyEnd = (state.line - nextLine) > 1 && state.isEmpty(state.line - 1);

    state.blkIndent = state.listIndent;
    state.listIndent = oldListIndent;
    state.tShift[nextLine] = oldTShift;
    state.sCount[nextLine] = oldSCount;
    state.tight = oldTight;

    token        = state.push('list_item_close', 'li', -1);
    token.markup = String.fromCharCode(markerCharCode);

    nextLine = state.line;
    itemLines[1] = nextLine;

    if (nextLine >= endLine) { break }

    //
    // Try to check if list is terminated or continued.
    //
    if (state.sCount[nextLine] < state.blkIndent) { break }

    // if it's indented more than 3 spaces, it should be a code block
    if (state.sCount[nextLine] - state.blkIndent >= 4) { break }

    // fail if terminating block found
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break
      }
    }
    if (terminate) { break }

    // fail if list has another type
    if (isOrdered) {
      posAfterMarker = skipOrderedListMarker(state, nextLine);
      if (posAfterMarker < 0) { break }
      start = state.bMarks[nextLine] + state.tShift[nextLine];
    } else {
      posAfterMarker = skipBulletListMarker(state, nextLine);
      if (posAfterMarker < 0) { break }
    }

    if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) { break }
  }

  // Finalize list
  if (isOrdered) {
    token = state.push('ordered_list_close', 'ol', -1);
  } else {
    token = state.push('bullet_list_close', 'ul', -1);
  }
  token.markup = String.fromCharCode(markerCharCode);

  listLines[1] = nextLine;
  state.line = nextLine;

  state.parentType = oldParentType;

  // mark paragraphs tight if needed
  if (tight) {
    markTightParagraphs(state, listTokIdx);
  }

  return true
}

function reference (state, startLine, _endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  let nextLine = startLine + 1;

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  if (state.src.charCodeAt(pos) !== 0x5B/* [ */) { return false }

  function getNextLine (nextLine) {
    const endLine = state.lineMax;

    if (nextLine >= endLine || state.isEmpty(nextLine)) {
      // empty line or end of input
      return null
    }

    let isContinuation = false;

    // this would be a code block normally, but after paragraph
    // it's considered a lazy continuation regardless of what's there
    if (state.sCount[nextLine] - state.blkIndent > 3) { isContinuation = true; }

    // quirk for blockquotes, this line should already be checked by that rule
    if (state.sCount[nextLine] < 0) { isContinuation = true; }

    if (!isContinuation) {
      const terminatorRules = state.md.block.ruler.getRules('reference');
      const oldParentType = state.parentType;
      state.parentType = 'reference';

      // Some tags can terminate paragraph without empty line.
      let terminate = false;
      for (let i = 0, l = terminatorRules.length; i < l; i++) {
        if (terminatorRules[i](state, nextLine, endLine, true)) {
          terminate = true;
          break
        }
      }

      state.parentType = oldParentType;
      if (terminate) {
        // terminated by another block
        return null
      }
    }

    const pos = state.bMarks[nextLine] + state.tShift[nextLine];
    const max = state.eMarks[nextLine];

    // max + 1 explicitly includes the newline
    return state.src.slice(pos, max + 1)
  }

  let str = state.src.slice(pos, max + 1);

  max = str.length;
  let labelEnd = -1;

  for (pos = 1; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 0x5B /* [ */) {
      return false
    } else if (ch === 0x5D /* ] */) {
      labelEnd = pos;
      break
    } else if (ch === 0x0A /* \n */) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (ch === 0x5C /* \ */) {
      pos++;
      if (pos < max && str.charCodeAt(pos) === 0x0A) {
        const lineContent = getNextLine(nextLine);
        if (lineContent !== null) {
          str += lineContent;
          max = str.length;
          nextLine++;
        }
      }
    }
  }

  if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 0x3A/* : */) { return false }

  // [label]:   destination   'title'
  //         ^^^ skip optional whitespace here
  for (pos = labelEnd + 2; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 0x0A) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (isSpace(ch)) ; else {
      break
    }
  }

  // [label]:   destination   'title'
  //            ^^^^^^^^^^^ parse this
  const destRes = state.md.helpers.parseLinkDestination(str, pos, max);
  if (!destRes.ok) { return false }

  const href = state.md.normalizeLink(destRes.str);
  if (!state.md.validateLink(href)) { return false }

  pos = destRes.pos;

  // save cursor state, we could require to rollback later
  const destEndPos = pos;
  const destEndLineNo = nextLine;

  // [label]:   destination   'title'
  //                       ^^^ skipping those spaces
  const start = pos;
  for (; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 0x0A) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (isSpace(ch)) ; else {
      break
    }
  }

  // [label]:   destination   'title'
  //                          ^^^^^^^ parse this
  let titleRes = state.md.helpers.parseLinkTitle(str, pos, max);
  while (titleRes.can_continue) {
    const lineContent = getNextLine(nextLine);
    if (lineContent === null) break
    str += lineContent;
    pos = max;
    max = str.length;
    nextLine++;
    titleRes = state.md.helpers.parseLinkTitle(str, pos, max, titleRes);
  }
  let title;

  if (pos < max && start !== pos && titleRes.ok) {
    title = titleRes.str;
    pos = titleRes.pos;
  } else {
    title = '';
    pos = destEndPos;
    nextLine = destEndLineNo;
  }

  // skip trailing spaces until the rest of the line
  while (pos < max) {
    const ch = str.charCodeAt(pos);
    if (!isSpace(ch)) { break }
    pos++;
  }

  if (pos < max && str.charCodeAt(pos) !== 0x0A) {
    if (title) {
      // garbage at the end of the line after title,
      // but it could still be a valid reference if we roll back
      title = '';
      pos = destEndPos;
      nextLine = destEndLineNo;
      while (pos < max) {
        const ch = str.charCodeAt(pos);
        if (!isSpace(ch)) { break }
        pos++;
      }
    }
  }

  if (pos < max && str.charCodeAt(pos) !== 0x0A) {
    // garbage at the end of the line
    return false
  }

  const label = normalizeReference(str.slice(1, labelEnd));
  if (!label) {
    // CommonMark 0.20 disallows empty labels
    return false
  }

  // Reference can not terminate anything. This check is for safety only.
  /* istanbul ignore if */
  if (silent) { return true }

  if (typeof state.env.references === 'undefined') {
    state.env.references = {};
  }
  if (typeof state.env.references[label] === 'undefined') {
    state.env.references[label] = { title, href };
  }

  state.line = nextLine;
  return true
}

// List of valid html blocks names, according to commonmark spec
// https://spec.commonmark.org/0.30/#html-blocks

var block_names = [
  'address',
  'article',
  'aside',
  'base',
  'basefont',
  'blockquote',
  'body',
  'caption',
  'center',
  'col',
  'colgroup',
  'dd',
  'details',
  'dialog',
  'dir',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'frame',
  'frameset',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hr',
  'html',
  'iframe',
  'legend',
  'li',
  'link',
  'main',
  'menu',
  'menuitem',
  'nav',
  'noframes',
  'ol',
  'optgroup',
  'option',
  'p',
  'param',
  'search',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'title',
  'tr',
  'track',
  'ul'
];

// Regexps to match html elements

const attr_name     = '[a-zA-Z_:][a-zA-Z0-9:._-]*';

const unquoted      = '[^"\'=<>`\\x00-\\x20]+';
const single_quoted = "'[^']*'";
const double_quoted = '"[^"]*"';

const attr_value  = '(?:' + unquoted + '|' + single_quoted + '|' + double_quoted + ')';

const attribute   = '(?:\\s+' + attr_name + '(?:\\s*=\\s*' + attr_value + ')?)';

const open_tag    = '<[A-Za-z][A-Za-z0-9\\-]*' + attribute + '*\\s*\\/?>';

const close_tag   = '<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>';
const comment     = '<!---?>|<!--(?:[^-]|-[^-]|--[^>])*-->';
const processing  = '<[?][\\s\\S]*?[?]>';
const declaration = '<![A-Za-z][^>]*>';
const cdata       = '<!\\[CDATA\\[[\\s\\S]*?\\]\\]>';

const HTML_TAG_RE = new RegExp('^(?:' + open_tag + '|' + close_tag + '|' + comment +
                        '|' + processing + '|' + declaration + '|' + cdata + ')');
const HTML_OPEN_CLOSE_TAG_RE = new RegExp('^(?:' + open_tag + '|' + close_tag + ')');

// HTML block


// An array of opening and corresponding closing sequences for html tags,
// last argument defines whether it can terminate a paragraph or not
//
const HTML_SEQUENCES = [
  [/^<(script|pre|style|textarea)(?=(\s|>|$))/i, /<\/(script|pre|style|textarea)>/i, true],
  [/^<!--/,        /-->/,   true],
  [/^<\?/,         /\?>/,   true],
  [/^<![A-Z]/,     />/,     true],
  [/^<!\[CDATA\[/, /\]\]>/, true],
  [new RegExp('^</?(' + block_names.join('|') + ')(?=(\\s|/?>|$))', 'i'), /^$/, true],
  [new RegExp(HTML_OPEN_CLOSE_TAG_RE.source + '\\s*$'),  /^$/, false]
];

function html_block (state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  if (!state.md.options.html) { return false }

  if (state.src.charCodeAt(pos) !== 0x3C/* < */) { return false }

  let lineText = state.src.slice(pos, max);

  let i = 0;
  for (; i < HTML_SEQUENCES.length; i++) {
    if (HTML_SEQUENCES[i][0].test(lineText)) { break }
  }
  if (i === HTML_SEQUENCES.length) { return false }

  if (silent) {
    // true if this sequence can be a terminator, false otherwise
    return HTML_SEQUENCES[i][2]
  }

  let nextLine = startLine + 1;

  // If we are here - we detected HTML block.
  // Let's roll down till block end.
  if (!HTML_SEQUENCES[i][1].test(lineText)) {
    for (; nextLine < endLine; nextLine++) {
      if (state.sCount[nextLine] < state.blkIndent) { break }

      pos = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];
      lineText = state.src.slice(pos, max);

      if (HTML_SEQUENCES[i][1].test(lineText)) {
        if (lineText.length !== 0) { nextLine++; }
        break
      }
    }
  }

  state.line = nextLine;

  const token   = state.push('html_block', '', 0);
  token.map     = [startLine, nextLine];
  token.content = state.getLines(startLine, nextLine, state.blkIndent, true);

  return true
}

// heading (#, ##, ...)


function heading (state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  let ch  = state.src.charCodeAt(pos);

  if (ch !== 0x23/* # */ || pos >= max) { return false }

  // count heading level
  let level = 1;
  ch = state.src.charCodeAt(++pos);
  while (ch === 0x23/* # */ && pos < max && level <= 6) {
    level++;
    ch = state.src.charCodeAt(++pos);
  }

  if (level > 6 || (pos < max && !isSpace(ch))) { return false }

  if (silent) { return true }

  // Let's cut tails like '    ###  ' from the end of string

  max = state.skipSpacesBack(max, pos);
  const tmp = state.skipCharsBack(max, 0x23, pos); // #
  if (tmp > pos && isSpace(state.src.charCodeAt(tmp - 1))) {
    max = tmp;
  }

  state.line = startLine + 1;

  const token_o  = state.push('heading_open', 'h' + String(level), 1);
  token_o.markup = '########'.slice(0, level);
  token_o.map    = [startLine, state.line];

  const token_i    = state.push('inline', '', 0);
  token_i.content  = state.src.slice(pos, max).trim();
  token_i.map      = [startLine, state.line];
  token_i.children = [];

  const token_c  = state.push('heading_close', 'h' + String(level), -1);
  token_c.markup = '########'.slice(0, level);

  return true
}

// lheading (---, ===)

function lheading (state, startLine, endLine/*, silent */) {
  const terminatorRules = state.md.block.ruler.getRules('paragraph');

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  const oldParentType = state.parentType;
  state.parentType = 'paragraph'; // use paragraph to match terminatorRules

  // jump line-by-line until empty one or EOF
  let level = 0;
  let marker;
  let nextLine = startLine + 1;

  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    // this would be a code block normally, but after paragraph
    // it's considered a lazy continuation regardless of what's there
    if (state.sCount[nextLine] - state.blkIndent > 3) { continue }

    //
    // Check for underline in setext header
    //
    if (state.sCount[nextLine] >= state.blkIndent) {
      let pos = state.bMarks[nextLine] + state.tShift[nextLine];
      const max = state.eMarks[nextLine];

      if (pos < max) {
        marker = state.src.charCodeAt(pos);

        if (marker === 0x2D/* - */ || marker === 0x3D/* = */) {
          pos = state.skipChars(pos, marker);
          pos = state.skipSpaces(pos);

          if (pos >= max) {
            level = (marker === 0x3D/* = */ ? 1 : 2);
            break
          }
        }
      }
    }

    // quirk for blockquotes, this line should already be checked by that rule
    if (state.sCount[nextLine] < 0) { continue }

    // Some tags can terminate paragraph without empty line.
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break
      }
    }
    if (terminate) { break }
  }

  if (!level) {
    // Didn't find valid underline
    return false
  }

  const content = state.getLines(startLine, nextLine, state.blkIndent, false).trim();

  state.line = nextLine + 1;

  const token_o    = state.push('heading_open', 'h' + String(level), 1);
  token_o.markup   = String.fromCharCode(marker);
  token_o.map      = [startLine, state.line];

  const token_i    = state.push('inline', '', 0);
  token_i.content  = content;
  token_i.map      = [startLine, state.line - 1];
  token_i.children = [];

  const token_c    = state.push('heading_close', 'h' + String(level), -1);
  token_c.markup   = String.fromCharCode(marker);

  state.parentType = oldParentType;

  return true
}

// Paragraph

function paragraph (state, startLine, endLine) {
  const terminatorRules = state.md.block.ruler.getRules('paragraph');
  const oldParentType = state.parentType;
  let nextLine = startLine + 1;
  state.parentType = 'paragraph';

  // jump line-by-line until empty one or EOF
  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    // this would be a code block normally, but after paragraph
    // it's considered a lazy continuation regardless of what's there
    if (state.sCount[nextLine] - state.blkIndent > 3) { continue }

    // quirk for blockquotes, this line should already be checked by that rule
    if (state.sCount[nextLine] < 0) { continue }

    // Some tags can terminate paragraph without empty line.
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break
      }
    }
    if (terminate) { break }
  }

  const content = state.getLines(startLine, nextLine, state.blkIndent, false).trim();

  state.line = nextLine;

  const token_o    = state.push('paragraph_open', 'p', 1);
  token_o.map      = [startLine, state.line];

  const token_i    = state.push('inline', '', 0);
  token_i.content  = content;
  token_i.map      = [startLine, state.line];
  token_i.children = [];

  state.push('paragraph_close', 'p', -1);

  state.parentType = oldParentType;

  return true
}

/** internal
 * class ParserBlock
 *
 * Block-level tokenizer.
 **/


const _rules$1 = [
  // First 2 params - rule name & source. Secondary array - list of rules,
  // which can be terminated by this one.
  ['table',      table,      ['paragraph', 'reference']],
  ['code',       code],
  ['fence',      fence,      ['paragraph', 'reference', 'blockquote', 'list']],
  ['blockquote', blockquote, ['paragraph', 'reference', 'blockquote', 'list']],
  ['hr',         hr,         ['paragraph', 'reference', 'blockquote', 'list']],
  ['list',       list,       ['paragraph', 'reference', 'blockquote']],
  ['reference',  reference],
  ['html_block', html_block, ['paragraph', 'reference', 'blockquote']],
  ['heading',    heading,    ['paragraph', 'reference', 'blockquote']],
  ['lheading',   lheading],
  ['paragraph',  paragraph]
];

/**
 * new ParserBlock()
 **/
function ParserBlock () {
  /**
   * ParserBlock#ruler -> Ruler
   *
   * [[Ruler]] instance. Keep configuration of block rules.
   **/
  this.ruler = new Ruler();

  for (let i = 0; i < _rules$1.length; i++) {
    this.ruler.push(_rules$1[i][0], _rules$1[i][1], { alt: (_rules$1[i][2] || []).slice() });
  }
}

// Generate tokens for input range
//
ParserBlock.prototype.tokenize = function (state, startLine, endLine) {
  const rules = this.ruler.getRules('');
  const len = rules.length;
  const maxNesting = state.md.options.maxNesting;
  let line = startLine;
  let hasEmptyLines = false;

  while (line < endLine) {
    state.line = line = state.skipEmptyLines(line);
    if (line >= endLine) { break }

    // Termination condition for nested calls.
    // Nested calls currently used for blockquotes & lists
    if (state.sCount[line] < state.blkIndent) { break }

    // If nesting level exceeded - skip tail to the end. That's not ordinary
    // situation and we should not care about content.
    if (state.level >= maxNesting) {
      state.line = endLine;
      break
    }

    // Try all possible rules.
    // On success, rule should:
    //
    // - update `state.line`
    // - update `state.tokens`
    // - return true
    const prevLine = state.line;
    let ok = false;

    for (let i = 0; i < len; i++) {
      ok = rules[i](state, line, endLine, false);
      if (ok) {
        if (prevLine >= state.line) {
          throw new Error("block rule didn't increment state.line")
        }
        break
      }
    }

    // this can only happen if user disables paragraph rule
    if (!ok) throw new Error('none of the block rules matched')

    // set state.tight if we had an empty line before current tag
    // i.e. latest empty line should not count
    state.tight = !hasEmptyLines;

    // paragraph might "eat" one newline after it in nested lists
    if (state.isEmpty(state.line - 1)) {
      hasEmptyLines = true;
    }

    line = state.line;

    if (line < endLine && state.isEmpty(line)) {
      hasEmptyLines = true;
      line++;
      state.line = line;
    }
  }
};

/**
 * ParserBlock.parse(str, md, env, outTokens)
 *
 * Process input string and push block tokens into `outTokens`
 **/
ParserBlock.prototype.parse = function (src, md, env, outTokens) {
  if (!src) { return }

  const state = new this.State(src, md, env, outTokens);

  this.tokenize(state, state.line, state.lineMax);
};

ParserBlock.prototype.State = StateBlock;

// Inline parser state


function StateInline (src, md, env, outTokens) {
  this.src = src;
  this.env = env;
  this.md = md;
  this.tokens = outTokens;
  this.tokens_meta = Array(outTokens.length);

  this.pos = 0;
  this.posMax = this.src.length;
  this.level = 0;
  this.pending = '';
  this.pendingLevel = 0;

  // Stores { start: end } pairs. Useful for backtrack
  // optimization of pairs parse (emphasis, strikes).
  this.cache = {};

  // List of emphasis-like delimiters for current tag
  this.delimiters = [];

  // Stack of delimiter lists for upper level tags
  this._prev_delimiters = [];

  // backtick length => last seen position
  this.backticks = {};
  this.backticksScanned = false;

  // Counter used to disable inline linkify-it execution
  // inside <a> and markdown links
  this.linkLevel = 0;
}

// Flush pending text
//
StateInline.prototype.pushPending = function () {
  const token = new Token('text', '', 0);
  token.content = this.pending;
  token.level = this.pendingLevel;
  this.tokens.push(token);
  this.pending = '';
  return token
};

// Push new token to "stream".
// If pending text exists - flush it as text token
//
StateInline.prototype.push = function (type, tag, nesting) {
  if (this.pending) {
    this.pushPending();
  }

  const token = new Token(type, tag, nesting);
  let token_meta = null;

  if (nesting < 0) {
    // closing tag
    this.level--;
    this.delimiters = this._prev_delimiters.pop();
  }

  token.level = this.level;

  if (nesting > 0) {
    // opening tag
    this.level++;
    this._prev_delimiters.push(this.delimiters);
    this.delimiters = [];
    token_meta = { delimiters: this.delimiters };
  }

  this.pendingLevel = this.level;
  this.tokens.push(token);
  this.tokens_meta.push(token_meta);
  return token
};

// Scan a sequence of emphasis-like markers, and determine whether
// it can start an emphasis sequence or end an emphasis sequence.
//
//  - start - position to scan from (it should point at a valid marker);
//  - canSplitWord - determine if these markers can be found inside a word
//
StateInline.prototype.scanDelims = function (start, canSplitWord) {
  const max = this.posMax;
  const marker = this.src.charCodeAt(start);

  // treat beginning of the line as a whitespace
  const lastChar = start > 0 ? this.src.charCodeAt(start - 1) : 0x20;

  let pos = start;
  while (pos < max && this.src.charCodeAt(pos) === marker) { pos++; }

  const count = pos - start;

  // treat end of the line as a whitespace
  const nextChar = pos < max ? this.src.charCodeAt(pos) : 0x20;

  const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar));
  const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar));

  const isLastWhiteSpace = isWhiteSpace(lastChar);
  const isNextWhiteSpace = isWhiteSpace(nextChar);

  const left_flanking =
    !isNextWhiteSpace && (!isNextPunctChar || isLastWhiteSpace || isLastPunctChar);
  const right_flanking =
    !isLastWhiteSpace && (!isLastPunctChar || isNextWhiteSpace || isNextPunctChar);

  const can_open  = left_flanking  && (canSplitWord || !right_flanking || isLastPunctChar);
  const can_close = right_flanking && (canSplitWord || !left_flanking  || isNextPunctChar);

  return { can_open, can_close, length: count }
};

// re-export Token class to use in block rules
StateInline.prototype.Token = Token;

// Skip text characters for text token, place those to pending buffer
// and increment current pos

// Rule to skip pure text
// '{}$%@~+=:' reserved for extentions

// !, ", #, $, %, &, ', (, ), *, +, ,, -, ., /, :, ;, <, =, >, ?, @, [, \, ], ^, _, `, {, |, }, or ~

// !!!! Don't confuse with "Markdown ASCII Punctuation" chars
// http://spec.commonmark.org/0.15/#ascii-punctuation-character
function isTerminatorChar (ch) {
  switch (ch) {
    case 0x0A/* \n */:
    case 0x21/* ! */:
    case 0x23/* # */:
    case 0x24/* $ */:
    case 0x25/* % */:
    case 0x26/* & */:
    case 0x2A/* * */:
    case 0x2B/* + */:
    case 0x2D/* - */:
    case 0x3A/* : */:
    case 0x3C/* < */:
    case 0x3D/* = */:
    case 0x3E/* > */:
    case 0x40/* @ */:
    case 0x5B/* [ */:
    case 0x5C/* \ */:
    case 0x5D/* ] */:
    case 0x5E/* ^ */:
    case 0x5F/* _ */:
    case 0x60/* ` */:
    case 0x7B/* { */:
    case 0x7D/* } */:
    case 0x7E/* ~ */:
      return true
    default:
      return false
  }
}

function text (state, silent) {
  let pos = state.pos;

  while (pos < state.posMax && !isTerminatorChar(state.src.charCodeAt(pos))) {
    pos++;
  }

  if (pos === state.pos) { return false }

  if (!silent) { state.pending += state.src.slice(state.pos, pos); }

  state.pos = pos;

  return true
}

// Alternative implementation, for memory.
//
// It costs 10% of performance, but allows extend terminators list, if place it
// to `ParserInline` property. Probably, will switch to it sometime, such
// flexibility required.

/*
var TERMINATOR_RE = /[\n!#$%&*+\-:<=>@[\\\]^_`{}~]/;

module.exports = function text(state, silent) {
  var pos = state.pos,
      idx = state.src.slice(pos).search(TERMINATOR_RE);

  // first char is terminator -> empty text
  if (idx === 0) { return false; }

  // no terminator -> text till end of string
  if (idx < 0) {
    if (!silent) { state.pending += state.src.slice(pos); }
    state.pos = state.src.length;
    return true;
  }

  if (!silent) { state.pending += state.src.slice(pos, pos + idx); }

  state.pos += idx;

  return true;
}; */

// Process links like https://example.org/

// RFC3986: scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
const SCHEME_RE = /(?:^|[^a-z0-9.+-])([a-z][a-z0-9.+-]*)$/i;

function linkify (state, silent) {
  if (!state.md.options.linkify) return false
  if (state.linkLevel > 0) return false

  const pos = state.pos;
  const max = state.posMax;

  if (pos + 3 > max) return false
  if (state.src.charCodeAt(pos) !== 0x3A/* : */) return false
  if (state.src.charCodeAt(pos + 1) !== 0x2F/* / */) return false
  if (state.src.charCodeAt(pos + 2) !== 0x2F/* / */) return false

  const match = state.pending.match(SCHEME_RE);
  if (!match) return false

  const proto = match[1];

  const link = state.md.linkify.matchAtStart(state.src.slice(pos - proto.length));
  if (!link) return false

  let url = link.url;

  // invalid link, but still detected by linkify somehow;
  // need to check to prevent infinite loop below
  if (url.length <= proto.length) return false

  // disallow '*' at the end of the link (conflicts with emphasis)
  // do manual backsearch to avoid perf issues with regex /\*+$/ on "****...****a".
  let urlEnd = url.length;
  while (urlEnd > 0 && url.charCodeAt(urlEnd - 1) === 0x2A/* * */) {
    urlEnd--;
  }
  if (urlEnd !== url.length) {
    url = url.slice(0, urlEnd);
  }

  const fullUrl = state.md.normalizeLink(url);
  if (!state.md.validateLink(fullUrl)) return false

  if (!silent) {
    state.pending = state.pending.slice(0, -proto.length);

    const token_o = state.push('link_open', 'a', 1);
    token_o.attrs = [['href', fullUrl]];
    token_o.markup = 'linkify';
    token_o.info = 'auto';

    const token_t = state.push('text', '', 0);
    token_t.content = state.md.normalizeLinkText(url);

    const token_c = state.push('link_close', 'a', -1);
    token_c.markup = 'linkify';
    token_c.info = 'auto';
  }

  state.pos += url.length - proto.length;
  return true
}

// Proceess '\n'


function newline (state, silent) {
  let pos = state.pos;

  if (state.src.charCodeAt(pos) !== 0x0A/* \n */) { return false }

  const pmax = state.pending.length - 1;
  const max = state.posMax;

  // '  \n' -> hardbreak
  // Lookup in pending chars is bad practice! Don't copy to other rules!
  // Pending string is stored in concat mode, indexed lookups will cause
  // convertion to flat mode.
  if (!silent) {
    if (pmax >= 0 && state.pending.charCodeAt(pmax) === 0x20) {
      if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 0x20) {
        // Find whitespaces tail of pending chars.
        let ws = pmax - 1;
        while (ws >= 1 && state.pending.charCodeAt(ws - 1) === 0x20) ws--;

        state.pending = state.pending.slice(0, ws);
        state.push('hardbreak', 'br', 0);
      } else {
        state.pending = state.pending.slice(0, -1);
        state.push('softbreak', 'br', 0);
      }
    } else {
      state.push('softbreak', 'br', 0);
    }
  }

  pos++;

  // skip heading spaces for next line
  while (pos < max && isSpace(state.src.charCodeAt(pos))) { pos++; }

  state.pos = pos;
  return true
}

// Process escaped chars and hardbreaks


const ESCAPED = [];

for (let i = 0; i < 256; i++) { ESCAPED.push(0); }

'\\!"#$%&\'()*+,./:;<=>?@[]^_`{|}~-'
  .split('').forEach(function (ch) { ESCAPED[ch.charCodeAt(0)] = 1; });

function escape (state, silent) {
  let pos = state.pos;
  const max = state.posMax;

  if (state.src.charCodeAt(pos) !== 0x5C/* \ */) return false
  pos++;

  // '\' at the end of the inline block
  if (pos >= max) return false

  let ch1 = state.src.charCodeAt(pos);

  if (ch1 === 0x0A) {
    if (!silent) {
      state.push('hardbreak', 'br', 0);
    }

    pos++;
    // skip leading whitespaces from next line
    while (pos < max) {
      ch1 = state.src.charCodeAt(pos);
      if (!isSpace(ch1)) break
      pos++;
    }

    state.pos = pos;
    return true
  }

  let escapedStr = state.src[pos];

  if (ch1 >= 0xD800 && ch1 <= 0xDBFF && pos + 1 < max) {
    const ch2 = state.src.charCodeAt(pos + 1);

    if (ch2 >= 0xDC00 && ch2 <= 0xDFFF) {
      escapedStr += state.src[pos + 1];
      pos++;
    }
  }

  const origStr = '\\' + escapedStr;

  if (!silent) {
    const token = state.push('text_special', '', 0);

    if (ch1 < 256 && ESCAPED[ch1] !== 0) {
      token.content = escapedStr;
    } else {
      token.content = origStr;
    }

    token.markup = origStr;
    token.info   = 'escape';
  }

  state.pos = pos + 1;
  return true
}

// Parse backticks

function backtick (state, silent) {
  let pos = state.pos;
  const ch = state.src.charCodeAt(pos);

  if (ch !== 0x60/* ` */) { return false }

  const start = pos;
  pos++;
  const max = state.posMax;

  // scan marker length
  while (pos < max && state.src.charCodeAt(pos) === 0x60/* ` */) { pos++; }

  const marker = state.src.slice(start, pos);
  const openerLength = marker.length;

  if (state.backticksScanned && (state.backticks[openerLength] || 0) <= start) {
    if (!silent) state.pending += marker;
    state.pos += openerLength;
    return true
  }

  let matchEnd = pos;
  let matchStart;

  // Nothing found in the cache, scan until the end of the line (or until marker is found)
  while ((matchStart = state.src.indexOf('`', matchEnd)) !== -1) {
    matchEnd = matchStart + 1;

    // scan marker length
    while (matchEnd < max && state.src.charCodeAt(matchEnd) === 0x60/* ` */) { matchEnd++; }

    const closerLength = matchEnd - matchStart;

    if (closerLength === openerLength) {
      // Found matching closer length.
      if (!silent) {
        const token = state.push('code_inline', 'code', 0);
        token.markup = marker;
        token.content = state.src.slice(pos, matchStart)
          .replace(/\n/g, ' ')
          .replace(/^ (.+) $/, '$1');
      }
      state.pos = matchEnd;
      return true
    }

    // Some different length found, put it in cache as upper limit of where closer can be found
    state.backticks[closerLength] = matchStart;
  }

  // Scanned through the end, didn't find anything
  state.backticksScanned = true;

  if (!silent) state.pending += marker;
  state.pos += openerLength;
  return true
}

// ~~strike through~~
//

// Insert each marker as a separate text token, and add it to delimiter list
//
function strikethrough_tokenize (state, silent) {
  const start = state.pos;
  const marker = state.src.charCodeAt(start);

  if (silent) { return false }

  if (marker !== 0x7E/* ~ */) { return false }

  const scanned = state.scanDelims(state.pos, true);
  let len = scanned.length;
  const ch = String.fromCharCode(marker);

  if (len < 2) { return false }

  let token;

  if (len % 2) {
    token         = state.push('text', '', 0);
    token.content = ch;
    len--;
  }

  for (let i = 0; i < len; i += 2) {
    token         = state.push('text', '', 0);
    token.content = ch + ch;

    state.delimiters.push({
      marker,
      length: 0,     // disable "rule of 3" length checks meant for emphasis
      token: state.tokens.length - 1,
      end: -1,
      open: scanned.can_open,
      close: scanned.can_close
    });
  }

  state.pos += scanned.length;

  return true
}

function postProcess$1 (state, delimiters) {
  let token;
  const loneMarkers = [];
  const max = delimiters.length;

  for (let i = 0; i < max; i++) {
    const startDelim = delimiters[i];

    if (startDelim.marker !== 0x7E/* ~ */) {
      continue
    }

    if (startDelim.end === -1) {
      continue
    }

    const endDelim = delimiters[startDelim.end];

    token         = state.tokens[startDelim.token];
    token.type    = 's_open';
    token.tag     = 's';
    token.nesting = 1;
    token.markup  = '~~';
    token.content = '';

    token         = state.tokens[endDelim.token];
    token.type    = 's_close';
    token.tag     = 's';
    token.nesting = -1;
    token.markup  = '~~';
    token.content = '';

    if (state.tokens[endDelim.token - 1].type === 'text' &&
        state.tokens[endDelim.token - 1].content === '~') {
      loneMarkers.push(endDelim.token - 1);
    }
  }

  // If a marker sequence has an odd number of characters, it's splitted
  // like this: `~~~~~` -> `~` + `~~` + `~~`, leaving one marker at the
  // start of the sequence.
  //
  // So, we have to move all those markers after subsequent s_close tags.
  //
  while (loneMarkers.length) {
    const i = loneMarkers.pop();
    let j = i + 1;

    while (j < state.tokens.length && state.tokens[j].type === 's_close') {
      j++;
    }

    j--;

    if (i !== j) {
      token = state.tokens[j];
      state.tokens[j] = state.tokens[i];
      state.tokens[i] = token;
    }
  }
}

// Walk through delimiter list and replace text tokens with tags
//
function strikethrough_postProcess (state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;

  postProcess$1(state, state.delimiters);

  for (let curr = 0; curr < max; curr++) {
    if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
      postProcess$1(state, tokens_meta[curr].delimiters);
    }
  }
}

var r_strikethrough = {
  tokenize: strikethrough_tokenize,
  postProcess: strikethrough_postProcess
};

// Process *this* and _that_
//

// Insert each marker as a separate text token, and add it to delimiter list
//
function emphasis_tokenize (state, silent) {
  const start = state.pos;
  const marker = state.src.charCodeAt(start);

  if (silent) { return false }

  if (marker !== 0x5F /* _ */ && marker !== 0x2A /* * */) { return false }

  const scanned = state.scanDelims(state.pos, marker === 0x2A);

  for (let i = 0; i < scanned.length; i++) {
    const token = state.push('text', '', 0);
    token.content = String.fromCharCode(marker);

    state.delimiters.push({
      // Char code of the starting marker (number).
      //
      marker,

      // Total length of these series of delimiters.
      //
      length: scanned.length,

      // A position of the token this delimiter corresponds to.
      //
      token: state.tokens.length - 1,

      // If this delimiter is matched as a valid opener, `end` will be
      // equal to its position, otherwise it's `-1`.
      //
      end: -1,

      // Boolean flags that determine if this delimiter could open or close
      // an emphasis.
      //
      open: scanned.can_open,
      close: scanned.can_close
    });
  }

  state.pos += scanned.length;

  return true
}

function postProcess (state, delimiters) {
  const max = delimiters.length;

  for (let i = max - 1; i >= 0; i--) {
    const startDelim = delimiters[i];

    if (startDelim.marker !== 0x5F/* _ */ && startDelim.marker !== 0x2A/* * */) {
      continue
    }

    // Process only opening markers
    if (startDelim.end === -1) {
      continue
    }

    const endDelim = delimiters[startDelim.end];

    // If the previous delimiter has the same marker and is adjacent to this one,
    // merge those into one strong delimiter.
    //
    // `<em><em>whatever</em></em>` -> `<strong>whatever</strong>`
    //
    const isStrong = i > 0 &&
               delimiters[i - 1].end === startDelim.end + 1 &&
               // check that first two markers match and adjacent
               delimiters[i - 1].marker === startDelim.marker &&
               delimiters[i - 1].token === startDelim.token - 1 &&
               // check that last two markers are adjacent (we can safely assume they match)
               delimiters[startDelim.end + 1].token === endDelim.token + 1;

    const ch = String.fromCharCode(startDelim.marker);

    const token_o   = state.tokens[startDelim.token];
    token_o.type    = isStrong ? 'strong_open' : 'em_open';
    token_o.tag     = isStrong ? 'strong' : 'em';
    token_o.nesting = 1;
    token_o.markup  = isStrong ? ch + ch : ch;
    token_o.content = '';

    const token_c   = state.tokens[endDelim.token];
    token_c.type    = isStrong ? 'strong_close' : 'em_close';
    token_c.tag     = isStrong ? 'strong' : 'em';
    token_c.nesting = -1;
    token_c.markup  = isStrong ? ch + ch : ch;
    token_c.content = '';

    if (isStrong) {
      state.tokens[delimiters[i - 1].token].content = '';
      state.tokens[delimiters[startDelim.end + 1].token].content = '';
      i--;
    }
  }
}

// Walk through delimiter list and replace text tokens with tags
//
function emphasis_post_process (state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;

  postProcess(state, state.delimiters);

  for (let curr = 0; curr < max; curr++) {
    if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
      postProcess(state, tokens_meta[curr].delimiters);
    }
  }
}

var r_emphasis = {
  tokenize: emphasis_tokenize,
  postProcess: emphasis_post_process
};

// Process [link](<to> "stuff")


function link (state, silent) {
  let code, label, res, ref;
  let href = '';
  let title = '';
  let start = state.pos;
  let parseReference = true;

  if (state.src.charCodeAt(state.pos) !== 0x5B/* [ */) { return false }

  const oldPos = state.pos;
  const max = state.posMax;
  const labelStart = state.pos + 1;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos, true);

  // parser failed to find ']', so it's not a valid link
  if (labelEnd < 0) { return false }

  let pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 0x28/* ( */) {
    //
    // Inline link
    //

    // might have found a valid shortcut link, disable reference parsing
    parseReference = false;

    // [link](  <href>  "title"  )
    //        ^^ skipping these spaces
    pos++;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (!isSpace(code) && code !== 0x0A) { break }
    }
    if (pos >= max) { return false }

    // [link](  <href>  "title"  )
    //          ^^^^^^ parsing link destination
    start = pos;
    res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href)) {
        pos = res.pos;
      } else {
        href = '';
      }

      // [link](  <href>  "title"  )
      //                ^^ skipping these spaces
      start = pos;
      for (; pos < max; pos++) {
        code = state.src.charCodeAt(pos);
        if (!isSpace(code) && code !== 0x0A) { break }
      }

      // [link](  <href>  "title"  )
      //                  ^^^^^^^ parsing link title
      res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
      if (pos < max && start !== pos && res.ok) {
        title = res.str;
        pos = res.pos;

        // [link](  <href>  "title"  )
        //                         ^^ skipping these spaces
        for (; pos < max; pos++) {
          code = state.src.charCodeAt(pos);
          if (!isSpace(code) && code !== 0x0A) { break }
        }
      }
    }

    if (pos >= max || state.src.charCodeAt(pos) !== 0x29/* ) */) {
      // parsing a valid shortcut link failed, fallback to reference
      parseReference = true;
    }
    pos++;
  }

  if (parseReference) {
    //
    // Link reference
    //
    if (typeof state.env.references === 'undefined') { return false }

    if (pos < max && state.src.charCodeAt(pos) === 0x5B/* [ */) {
      start = pos + 1;
      pos = state.md.helpers.parseLinkLabel(state, pos);
      if (pos >= 0) {
        label = state.src.slice(start, pos++);
      } else {
        pos = labelEnd + 1;
      }
    } else {
      pos = labelEnd + 1;
    }

    // covers label === '' and label === undefined
    // (collapsed reference link and shortcut reference link respectively)
    if (!label) { label = state.src.slice(labelStart, labelEnd); }

    ref = state.env.references[normalizeReference(label)];
    if (!ref) {
      state.pos = oldPos;
      return false
    }
    href = ref.href;
    title = ref.title;
  }

  //
  // We found the end of the link, and know for a fact it's a valid link;
  // so all that's left to do is to call tokenizer.
  //
  if (!silent) {
    state.pos = labelStart;
    state.posMax = labelEnd;

    const token_o = state.push('link_open', 'a', 1);
    const attrs = [['href', href]];
    token_o.attrs  = attrs;
    if (title) {
      attrs.push(['title', title]);
    }

    state.linkLevel++;
    state.md.inline.tokenize(state);
    state.linkLevel--;

    state.push('link_close', 'a', -1);
  }

  state.pos = pos;
  state.posMax = max;
  return true
}

// Process ![image](<src> "title")


function image (state, silent) {
  let code, content, label, pos, ref, res, title, start;
  let href = '';
  const oldPos = state.pos;
  const max = state.posMax;

  if (state.src.charCodeAt(state.pos) !== 0x21/* ! */) { return false }
  if (state.src.charCodeAt(state.pos + 1) !== 0x5B/* [ */) { return false }

  const labelStart = state.pos + 2;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos + 1, false);

  // parser failed to find ']', so it's not a valid link
  if (labelEnd < 0) { return false }

  pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 0x28/* ( */) {
    //
    // Inline link
    //

    // [link](  <href>  "title"  )
    //        ^^ skipping these spaces
    pos++;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (!isSpace(code) && code !== 0x0A) { break }
    }
    if (pos >= max) { return false }

    // [link](  <href>  "title"  )
    //          ^^^^^^ parsing link destination
    start = pos;
    res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href)) {
        pos = res.pos;
      } else {
        href = '';
      }
    }

    // [link](  <href>  "title"  )
    //                ^^ skipping these spaces
    start = pos;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (!isSpace(code) && code !== 0x0A) { break }
    }

    // [link](  <href>  "title"  )
    //                  ^^^^^^^ parsing link title
    res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
    if (pos < max && start !== pos && res.ok) {
      title = res.str;
      pos = res.pos;

      // [link](  <href>  "title"  )
      //                         ^^ skipping these spaces
      for (; pos < max; pos++) {
        code = state.src.charCodeAt(pos);
        if (!isSpace(code) && code !== 0x0A) { break }
      }
    } else {
      title = '';
    }

    if (pos >= max || state.src.charCodeAt(pos) !== 0x29/* ) */) {
      state.pos = oldPos;
      return false
    }
    pos++;
  } else {
    //
    // Link reference
    //
    if (typeof state.env.references === 'undefined') { return false }

    if (pos < max && state.src.charCodeAt(pos) === 0x5B/* [ */) {
      start = pos + 1;
      pos = state.md.helpers.parseLinkLabel(state, pos);
      if (pos >= 0) {
        label = state.src.slice(start, pos++);
      } else {
        pos = labelEnd + 1;
      }
    } else {
      pos = labelEnd + 1;
    }

    // covers label === '' and label === undefined
    // (collapsed reference link and shortcut reference link respectively)
    if (!label) { label = state.src.slice(labelStart, labelEnd); }

    ref = state.env.references[normalizeReference(label)];
    if (!ref) {
      state.pos = oldPos;
      return false
    }
    href = ref.href;
    title = ref.title;
  }

  //
  // We found the end of the link, and know for a fact it's a valid link;
  // so all that's left to do is to call tokenizer.
  //
  if (!silent) {
    content = state.src.slice(labelStart, labelEnd);

    const tokens = [];
    state.md.inline.parse(
      content,
      state.md,
      state.env,
      tokens
    );

    const token = state.push('image', 'img', 0);
    const attrs = [['src', href], ['alt', '']];
    token.attrs = attrs;
    token.children = tokens;
    token.content = content;

    if (title) {
      attrs.push(['title', title]);
    }
  }

  state.pos = pos;
  state.posMax = max;
  return true
}

// Process autolinks '<protocol:...>'

/* eslint max-len:0 */
const EMAIL_RE    = /^([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;
/* eslint-disable-next-line no-control-regex */
const AUTOLINK_RE = /^([a-zA-Z][a-zA-Z0-9+.-]{1,31}):([^<>\x00-\x20]*)$/;

function autolink (state, silent) {
  let pos = state.pos;

  if (state.src.charCodeAt(pos) !== 0x3C/* < */) { return false }

  const start = state.pos;
  const max = state.posMax;

  for (;;) {
    if (++pos >= max) return false

    const ch = state.src.charCodeAt(pos);

    if (ch === 0x3C /* < */) return false
    if (ch === 0x3E /* > */) break
  }

  const url = state.src.slice(start + 1, pos);

  if (AUTOLINK_RE.test(url)) {
    const fullUrl = state.md.normalizeLink(url);
    if (!state.md.validateLink(fullUrl)) { return false }

    if (!silent) {
      const token_o   = state.push('link_open', 'a', 1);
      token_o.attrs   = [['href', fullUrl]];
      token_o.markup  = 'autolink';
      token_o.info    = 'auto';

      const token_t   = state.push('text', '', 0);
      token_t.content = state.md.normalizeLinkText(url);

      const token_c   = state.push('link_close', 'a', -1);
      token_c.markup  = 'autolink';
      token_c.info    = 'auto';
    }

    state.pos += url.length + 2;
    return true
  }

  if (EMAIL_RE.test(url)) {
    const fullUrl = state.md.normalizeLink('mailto:' + url);
    if (!state.md.validateLink(fullUrl)) { return false }

    if (!silent) {
      const token_o   = state.push('link_open', 'a', 1);
      token_o.attrs   = [['href', fullUrl]];
      token_o.markup  = 'autolink';
      token_o.info    = 'auto';

      const token_t   = state.push('text', '', 0);
      token_t.content = state.md.normalizeLinkText(url);

      const token_c   = state.push('link_close', 'a', -1);
      token_c.markup  = 'autolink';
      token_c.info    = 'auto';
    }

    state.pos += url.length + 2;
    return true
  }

  return false
}

// Process html tags


function isLinkOpen (str) {
  return /^<a[>\s]/i.test(str)
}
function isLinkClose (str) {
  return /^<\/a\s*>/i.test(str)
}

function isLetter (ch) {
  /* eslint no-bitwise:0 */
  const lc = ch | 0x20; // to lower case
  return (lc >= 0x61/* a */) && (lc <= 0x7a/* z */)
}

function html_inline (state, silent) {
  if (!state.md.options.html) { return false }

  // Check start
  const max = state.posMax;
  const pos = state.pos;
  if (state.src.charCodeAt(pos) !== 0x3C/* < */ ||
      pos + 2 >= max) {
    return false
  }

  // Quick fail on second char
  const ch = state.src.charCodeAt(pos + 1);
  if (ch !== 0x21/* ! */ &&
      ch !== 0x3F/* ? */ &&
      ch !== 0x2F/* / */ &&
      !isLetter(ch)) {
    return false
  }

  const match = state.src.slice(pos).match(HTML_TAG_RE);
  if (!match) { return false }

  if (!silent) {
    const token = state.push('html_inline', '', 0);
    token.content = match[0];

    if (isLinkOpen(token.content))  state.linkLevel++;
    if (isLinkClose(token.content)) state.linkLevel--;
  }
  state.pos += match[0].length;
  return true
}

// Process html entity - &#123;, &#xAF;, &quot;, ...


const DIGITAL_RE = /^&#((?:x[a-f0-9]{1,6}|[0-9]{1,7}));/i;
const NAMED_RE   = /^&([a-z][a-z0-9]{1,31});/i;

function entity (state, silent) {
  const pos = state.pos;
  const max = state.posMax;

  if (state.src.charCodeAt(pos) !== 0x26/* & */) return false

  if (pos + 1 >= max) return false

  const ch = state.src.charCodeAt(pos + 1);

  if (ch === 0x23 /* # */) {
    const match = state.src.slice(pos).match(DIGITAL_RE);
    if (match) {
      if (!silent) {
        const code = match[1][0].toLowerCase() === 'x' ? parseInt(match[1].slice(1), 16) : parseInt(match[1], 10);

        const token   = state.push('text_special', '', 0);
        token.content = isValidEntityCode(code) ? fromCodePoint(code) : fromCodePoint(0xFFFD);
        token.markup  = match[0];
        token.info    = 'entity';
      }
      state.pos += match[0].length;
      return true
    }
  } else {
    const match = state.src.slice(pos).match(NAMED_RE);
    if (match) {
      const decoded = decodeHTML(match[0]);
      if (decoded !== match[0]) {
        if (!silent) {
          const token   = state.push('text_special', '', 0);
          token.content = decoded;
          token.markup  = match[0];
          token.info    = 'entity';
        }
        state.pos += match[0].length;
        return true
      }
    }
  }

  return false
}

// For each opening emphasis-like marker find a matching closing one
//

function processDelimiters (delimiters) {
  const openersBottom = {};
  const max = delimiters.length;

  if (!max) return

  // headerIdx is the first delimiter of the current (where closer is) delimiter run
  let headerIdx = 0;
  let lastTokenIdx = -2; // needs any value lower than -1
  const jumps = [];

  for (let closerIdx = 0; closerIdx < max; closerIdx++) {
    const closer = delimiters[closerIdx];

    jumps.push(0);

    // markers belong to same delimiter run if:
    //  - they have adjacent tokens
    //  - AND markers are the same
    //
    if (delimiters[headerIdx].marker !== closer.marker || lastTokenIdx !== closer.token - 1) {
      headerIdx = closerIdx;
    }

    lastTokenIdx = closer.token;

    // Length is only used for emphasis-specific "rule of 3",
    // if it's not defined (in strikethrough or 3rd party plugins),
    // we can default it to 0 to disable those checks.
    //
    closer.length = closer.length || 0;

    if (!closer.close) continue

    // Previously calculated lower bounds (previous fails)
    // for each marker, each delimiter length modulo 3,
    // and for whether this closer can be an opener;
    // https://github.com/commonmark/cmark/commit/34250e12ccebdc6372b8b49c44fab57c72443460
    /* eslint-disable-next-line no-prototype-builtins */
    if (!openersBottom.hasOwnProperty(closer.marker)) {
      openersBottom[closer.marker] = [-1, -1, -1, -1, -1, -1];
    }

    const minOpenerIdx = openersBottom[closer.marker][(closer.open ? 3 : 0) + (closer.length % 3)];

    let openerIdx = headerIdx - jumps[headerIdx] - 1;

    let newMinOpenerIdx = openerIdx;

    for (; openerIdx > minOpenerIdx; openerIdx -= jumps[openerIdx] + 1) {
      const opener = delimiters[openerIdx];

      if (opener.marker !== closer.marker) continue

      if (opener.open && opener.end < 0) {
        let isOddMatch = false;

        // from spec:
        //
        // If one of the delimiters can both open and close emphasis, then the
        // sum of the lengths of the delimiter runs containing the opening and
        // closing delimiters must not be a multiple of 3 unless both lengths
        // are multiples of 3.
        //
        if (opener.close || closer.open) {
          if ((opener.length + closer.length) % 3 === 0) {
            if (opener.length % 3 !== 0 || closer.length % 3 !== 0) {
              isOddMatch = true;
            }
          }
        }

        if (!isOddMatch) {
          // If previous delimiter cannot be an opener, we can safely skip
          // the entire sequence in future checks. This is required to make
          // sure algorithm has linear complexity (see *_*_*_*_*_... case).
          //
          const lastJump = openerIdx > 0 && !delimiters[openerIdx - 1].open
            ? jumps[openerIdx - 1] + 1
            : 0;

          jumps[closerIdx] = closerIdx - openerIdx + lastJump;
          jumps[openerIdx] = lastJump;

          closer.open  = false;
          opener.end   = closerIdx;
          opener.close = false;
          newMinOpenerIdx = -1;
          // treat next token as start of run,
          // it optimizes skips in **<...>**a**<...>** pathological case
          lastTokenIdx = -2;
          break
        }
      }
    }

    if (newMinOpenerIdx !== -1) {
      // If match for this delimiter run failed, we want to set lower bound for
      // future lookups. This is required to make sure algorithm has linear
      // complexity.
      //
      // See details here:
      // https://github.com/commonmark/cmark/issues/178#issuecomment-270417442
      //
      openersBottom[closer.marker][(closer.open ? 3 : 0) + ((closer.length || 0) % 3)] = newMinOpenerIdx;
    }
  }
}

function link_pairs (state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;

  processDelimiters(state.delimiters);

  for (let curr = 0; curr < max; curr++) {
    if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
      processDelimiters(tokens_meta[curr].delimiters);
    }
  }
}

// Clean up tokens after emphasis and strikethrough postprocessing:
// merge adjacent text nodes into one and re-calculate all token levels
//
// This is necessary because initially emphasis delimiter markers (*, _, ~)
// are treated as their own separate text tokens. Then emphasis rule either
// leaves them as text (needed to merge with adjacent text) or turns them
// into opening/closing tags (which messes up levels inside).
//

function fragments_join (state) {
  let curr, last;
  let level = 0;
  const tokens = state.tokens;
  const max = state.tokens.length;

  for (curr = last = 0; curr < max; curr++) {
    // re-calculate levels after emphasis/strikethrough turns some text nodes
    // into opening/closing tags
    if (tokens[curr].nesting < 0) level--; // closing tag
    tokens[curr].level = level;
    if (tokens[curr].nesting > 0) level++; // opening tag

    if (tokens[curr].type === 'text' &&
        curr + 1 < max &&
        tokens[curr + 1].type === 'text') {
      // collapse two adjacent text nodes
      tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
    } else {
      if (curr !== last) { tokens[last] = tokens[curr]; }

      last++;
    }
  }

  if (curr !== last) {
    tokens.length = last;
  }
}

/** internal
 * class ParserInline
 *
 * Tokenizes paragraph content.
 **/


// Parser rules

const _rules = [
  ['text',            text],
  ['linkify',         linkify],
  ['newline',         newline],
  ['escape',          escape],
  ['backticks',       backtick],
  ['strikethrough',   r_strikethrough.tokenize],
  ['emphasis',        r_emphasis.tokenize],
  ['link',            link],
  ['image',           image],
  ['autolink',        autolink],
  ['html_inline',     html_inline],
  ['entity',          entity]
];

// `rule2` ruleset was created specifically for emphasis/strikethrough
// post-processing and may be changed in the future.
//
// Don't use this for anything except pairs (plugins working with `balance_pairs`).
//
const _rules2 = [
  ['balance_pairs',   link_pairs],
  ['strikethrough',   r_strikethrough.postProcess],
  ['emphasis',        r_emphasis.postProcess],
  // rules for pairs separate '**' into its own text tokens, which may be left unused,
  // rule below merges unused segments back with the rest of the text
  ['fragments_join',  fragments_join]
];

/**
 * new ParserInline()
 **/
function ParserInline () {
  /**
   * ParserInline#ruler -> Ruler
   *
   * [[Ruler]] instance. Keep configuration of inline rules.
   **/
  this.ruler = new Ruler();

  for (let i = 0; i < _rules.length; i++) {
    this.ruler.push(_rules[i][0], _rules[i][1]);
  }

  /**
   * ParserInline#ruler2 -> Ruler
   *
   * [[Ruler]] instance. Second ruler used for post-processing
   * (e.g. in emphasis-like rules).
   **/
  this.ruler2 = new Ruler();

  for (let i = 0; i < _rules2.length; i++) {
    this.ruler2.push(_rules2[i][0], _rules2[i][1]);
  }
}

// Skip single token by running all rules in validation mode;
// returns `true` if any rule reported success
//
ParserInline.prototype.skipToken = function (state) {
  const pos = state.pos;
  const rules = this.ruler.getRules('');
  const len = rules.length;
  const maxNesting = state.md.options.maxNesting;
  const cache = state.cache;

  if (typeof cache[pos] !== 'undefined') {
    state.pos = cache[pos];
    return
  }

  let ok = false;

  if (state.level < maxNesting) {
    for (let i = 0; i < len; i++) {
      // Increment state.level and decrement it later to limit recursion.
      // It's harmless to do here, because no tokens are created. But ideally,
      // we'd need a separate private state variable for this purpose.
      //
      state.level++;
      ok = rules[i](state, true);
      state.level--;

      if (ok) {
        if (pos >= state.pos) { throw new Error("inline rule didn't increment state.pos") }
        break
      }
    }
  } else {
    // Too much nesting, just skip until the end of the paragraph.
    //
    // NOTE: this will cause links to behave incorrectly in the following case,
    //       when an amount of `[` is exactly equal to `maxNesting + 1`:
    //
    //       [[[[[[[[[[[[[[[[[[[[[foo]()
    //
    // TODO: remove this workaround when CM standard will allow nested links
    //       (we can replace it by preventing links from being parsed in
    //       validation mode)
    //
    state.pos = state.posMax;
  }

  if (!ok) { state.pos++; }
  cache[pos] = state.pos;
};

// Generate tokens for input range
//
ParserInline.prototype.tokenize = function (state) {
  const rules = this.ruler.getRules('');
  const len = rules.length;
  const end = state.posMax;
  const maxNesting = state.md.options.maxNesting;

  while (state.pos < end) {
    // Try all possible rules.
    // On success, rule should:
    //
    // - update `state.pos`
    // - update `state.tokens`
    // - return true
    const prevPos = state.pos;
    let ok = false;

    if (state.level < maxNesting) {
      for (let i = 0; i < len; i++) {
        ok = rules[i](state, false);
        if (ok) {
          if (prevPos >= state.pos) { throw new Error("inline rule didn't increment state.pos") }
          break
        }
      }
    }

    if (ok) {
      if (state.pos >= end) { break }
      continue
    }

    state.pending += state.src[state.pos++];
  }

  if (state.pending) {
    state.pushPending();
  }
};

/**
 * ParserInline.parse(str, md, env, outTokens)
 *
 * Process input string and push inline tokens into `outTokens`
 **/
ParserInline.prototype.parse = function (str, md, env, outTokens) {
  const state = new this.State(str, md, env, outTokens);

  this.tokenize(state);

  const rules = this.ruler2.getRules('');
  const len = rules.length;

  for (let i = 0; i < len; i++) {
    rules[i](state);
  }
};

ParserInline.prototype.State = StateInline;

function reFactory (opts) {
  const re = {};
  opts = opts || {};

  re.src_Any = Any.source;
  re.src_Cc = Cc.source;
  re.src_Z = Z.source;
  re.src_P = P.source;

  // \p{\Z\P\Cc\CF} (white spaces + control + format + punctuation)
  re.src_ZPCc = [re.src_Z, re.src_P, re.src_Cc].join('|');

  // \p{\Z\Cc} (white spaces + control)
  re.src_ZCc = [re.src_Z, re.src_Cc].join('|');

  // Experimental. List of chars, completely prohibited in links
  // because can separate it from other part of text
  const text_separators = '[><\uff5c]';

  // All possible word characters (everything without punctuation, spaces & controls)
  // Defined via punctuation & spaces to save space
  // Should be something like \p{\L\N\S\M} (\w but without `_`)
  re.src_pseudo_letter = '(?:(?!' + text_separators + '|' + re.src_ZPCc + ')' + re.src_Any + ')';
  // The same as abothe but without [0-9]
  // var src_pseudo_letter_non_d = '(?:(?![0-9]|' + src_ZPCc + ')' + src_Any + ')';

  re.src_ip4 =

    '(?:(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)';

  // Prohibit any of "@/[]()" in user/pass to avoid wrong domain fetch.
  re.src_auth = '(?:(?:(?!' + re.src_ZCc + '|[@/\\[\\]()]).)+@)?';

  re.src_port =

    '(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?';

  re.src_host_terminator =

    '(?=$|' + text_separators + '|' + re.src_ZPCc + ')' +
    '(?!' + (opts['---'] ? '-(?!--)|' : '-|') + '_|:\\d|\\.-|\\.(?!$|' + re.src_ZPCc + '))';

  re.src_path =

    '(?:' +
      '[/?#]' +
        '(?:' +
          '(?!' + re.src_ZCc + '|' + text_separators + '|[()[\\]{}.,"\'?!\\-;]).|' +
          '\\[(?:(?!' + re.src_ZCc + '|\\]).)*\\]|' +
          '\\((?:(?!' + re.src_ZCc + '|[)]).)*\\)|' +
          '\\{(?:(?!' + re.src_ZCc + '|[}]).)*\\}|' +
          '\\"(?:(?!' + re.src_ZCc + '|["]).)+\\"|' +
          "\\'(?:(?!" + re.src_ZCc + "|[']).)+\\'|" +

          // allow `I'm_king` if no pair found
          "\\'(?=" + re.src_pseudo_letter + '|[-])|' +

          // google has many dots in "google search" links (#66, #81).
          // github has ... in commit range links,
          // Restrict to
          // - english
          // - percent-encoded
          // - parts of file path
          // - params separator
          // until more examples found.
          '\\.{2,}[a-zA-Z0-9%/&]|' +

          '\\.(?!' + re.src_ZCc + '|[.]|$)|' +
          (opts['---']
            ? '\\-(?!--(?:[^-]|$))(?:-*)|' // `---` => long dash, terminate
            : '\\-+|'
          ) +
          // allow `,,,` in paths
          ',(?!' + re.src_ZCc + '|$)|' +

          // allow `;` if not followed by space-like char
          ';(?!' + re.src_ZCc + '|$)|' +

          // allow `!!!` in paths, but not at the end
          '\\!+(?!' + re.src_ZCc + '|[!]|$)|' +

          '\\?(?!' + re.src_ZCc + '|[?]|$)' +
        ')+' +
      '|\\/' +
    ')?';

  // Allow anything in markdown spec, forbid quote (") at the first position
  // because emails enclosed in quotes are far more common
  re.src_email_name =

    '[\\-;:&=\\+\\$,\\.a-zA-Z0-9_][\\-;:&=\\+\\$,\\"\\.a-zA-Z0-9_]*';

  re.src_xn =

    'xn--[a-z0-9\\-]{1,59}';

  // More to read about domain names
  // http://serverfault.com/questions/638260/

  re.src_domain_root =

    // Allow letters & digits (http://test1)
    '(?:' +
      re.src_xn +
      '|' +
      re.src_pseudo_letter + '{1,63}' +
    ')';

  re.src_domain =

    '(?:' +
      re.src_xn +
      '|' +
      '(?:' + re.src_pseudo_letter + ')' +
      '|' +
      '(?:' + re.src_pseudo_letter + '(?:-|' + re.src_pseudo_letter + '){0,61}' + re.src_pseudo_letter + ')' +
    ')';

  re.src_host =

    '(?:' +
    // Don't need IP check, because digits are already allowed in normal domain names
    //   src_ip4 +
    // '|' +
      '(?:(?:(?:' + re.src_domain + ')\\.)*' + re.src_domain/* _root */ + ')' +
    ')';

  re.tpl_host_fuzzy =

    '(?:' +
      re.src_ip4 +
    '|' +
      '(?:(?:(?:' + re.src_domain + ')\\.)+(?:%TLDS%))' +
    ')';

  re.tpl_host_no_ip_fuzzy =

    '(?:(?:(?:' + re.src_domain + ')\\.)+(?:%TLDS%))';

  re.src_host_strict =

    re.src_host + re.src_host_terminator;

  re.tpl_host_fuzzy_strict =

    re.tpl_host_fuzzy + re.src_host_terminator;

  re.src_host_port_strict =

    re.src_host + re.src_port + re.src_host_terminator;

  re.tpl_host_port_fuzzy_strict =

    re.tpl_host_fuzzy + re.src_port + re.src_host_terminator;

  re.tpl_host_port_no_ip_fuzzy_strict =

    re.tpl_host_no_ip_fuzzy + re.src_port + re.src_host_terminator;

  //
  // Main rules
  //

  // Rude test fuzzy links by host, for quick deny
  re.tpl_host_fuzzy_test =

    'localhost|www\\.|\\.\\d{1,3}\\.|(?:\\.(?:%TLDS%)(?:' + re.src_ZPCc + '|>|$))';

  re.tpl_email_fuzzy =

      '(^|' + text_separators + '|"|\\(|' + re.src_ZCc + ')' +
      '(' + re.src_email_name + '@' + re.tpl_host_fuzzy_strict + ')';

  re.tpl_link_fuzzy =
      // Fuzzy link can't be prepended with .:/\- and non punctuation.
      // but can start with > (markdown blockquote)
      '(^|(?![.:/\\-_@])(?:[$+<=>^`|\uff5c]|' + re.src_ZPCc + '))' +
      '((?![$+<=>^`|\uff5c])' + re.tpl_host_port_fuzzy_strict + re.src_path + ')';

  re.tpl_link_no_ip_fuzzy =
      // Fuzzy link can't be prepended with .:/\- and non punctuation.
      // but can start with > (markdown blockquote)
      '(^|(?![.:/\\-_@])(?:[$+<=>^`|\uff5c]|' + re.src_ZPCc + '))' +
      '((?![$+<=>^`|\uff5c])' + re.tpl_host_port_no_ip_fuzzy_strict + re.src_path + ')';

  return re
}

//
// Helpers
//

// Merge objects
//
function assign (obj /* from1, from2, from3, ... */) {
  const sources = Array.prototype.slice.call(arguments, 1);

  sources.forEach(function (source) {
    if (!source) { return }

    Object.keys(source).forEach(function (key) {
      obj[key] = source[key];
    });
  });

  return obj
}

function _class (obj) { return Object.prototype.toString.call(obj) }
function isString (obj) { return _class(obj) === '[object String]' }
function isObject (obj) { return _class(obj) === '[object Object]' }
function isRegExp (obj) { return _class(obj) === '[object RegExp]' }
function isFunction (obj) { return _class(obj) === '[object Function]' }

function escapeRE (str) { return str.replace(/[.?*+^$[\]\\(){}|-]/g, '\\$&') }

//

const defaultOptions = {
  fuzzyLink: true,
  fuzzyEmail: true,
  fuzzyIP: false
};

function isOptionsObj (obj) {
  return Object.keys(obj || {}).reduce(function (acc, k) {
    /* eslint-disable-next-line no-prototype-builtins */
    return acc || defaultOptions.hasOwnProperty(k)
  }, false)
}

const defaultSchemas = {
  'http:': {
    validate: function (text, pos, self) {
      const tail = text.slice(pos);

      if (!self.re.http) {
        // compile lazily, because "host"-containing variables can change on tlds update.
        self.re.http = new RegExp(
          '^\\/\\/' + self.re.src_auth + self.re.src_host_port_strict + self.re.src_path, 'i'
        );
      }
      if (self.re.http.test(tail)) {
        return tail.match(self.re.http)[0].length
      }
      return 0
    }
  },
  'https:': 'http:',
  'ftp:': 'http:',
  '//': {
    validate: function (text, pos, self) {
      const tail = text.slice(pos);

      if (!self.re.no_http) {
      // compile lazily, because "host"-containing variables can change on tlds update.
        self.re.no_http = new RegExp(
          '^' +
          self.re.src_auth +
          // Don't allow single-level domains, because of false positives like '//test'
          // with code comments
          '(?:localhost|(?:(?:' + self.re.src_domain + ')\\.)+' + self.re.src_domain_root + ')' +
          self.re.src_port +
          self.re.src_host_terminator +
          self.re.src_path,

          'i'
        );
      }

      if (self.re.no_http.test(tail)) {
        // should not be `://` & `///`, that protects from errors in protocol name
        if (pos >= 3 && text[pos - 3] === ':') { return 0 }
        if (pos >= 3 && text[pos - 3] === '/') { return 0 }
        return tail.match(self.re.no_http)[0].length
      }
      return 0
    }
  },
  'mailto:': {
    validate: function (text, pos, self) {
      const tail = text.slice(pos);

      if (!self.re.mailto) {
        self.re.mailto = new RegExp(
          '^' + self.re.src_email_name + '@' + self.re.src_host_strict, 'i'
        );
      }
      if (self.re.mailto.test(tail)) {
        return tail.match(self.re.mailto)[0].length
      }
      return 0
    }
  }
};

// RE pattern for 2-character tlds (autogenerated by ./support/tlds_2char_gen.js)
/* eslint-disable-next-line max-len */
const tlds_2ch_src_re = 'a[cdefgilmnoqrstuwxz]|b[abdefghijmnorstvwyz]|c[acdfghiklmnoruvwxyz]|d[ejkmoz]|e[cegrstu]|f[ijkmor]|g[abdefghilmnpqrstuwy]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[acdeghklmnopqrstuvwxyz]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[abcdeghijklmnortuvxyz]|t[cdfghjklmnortvwz]|u[agksyz]|v[aceginu]|w[fs]|y[et]|z[amw]';

// DON'T try to make PRs with changes. Extend TLDs with LinkifyIt.tlds() instead
const tlds_default = 'biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф'.split('|');

function resetScanCache (self) {
  self.__index__ = -1;
  self.__text_cache__ = '';
}

function createValidator (re) {
  return function (text, pos) {
    const tail = text.slice(pos);

    if (re.test(tail)) {
      return tail.match(re)[0].length
    }
    return 0
  }
}

function createNormalizer () {
  return function (match, self) {
    self.normalize(match);
  }
}

// Schemas compiler. Build regexps.
//
function compile (self) {
  // Load & clone RE patterns.
  const re = self.re = reFactory(self.__opts__);

  // Define dynamic patterns
  const tlds = self.__tlds__.slice();

  self.onCompile();

  if (!self.__tlds_replaced__) {
    tlds.push(tlds_2ch_src_re);
  }
  tlds.push(re.src_xn);

  re.src_tlds = tlds.join('|');

  function untpl (tpl) { return tpl.replace('%TLDS%', re.src_tlds) }

  re.email_fuzzy = RegExp(untpl(re.tpl_email_fuzzy), 'i');
  re.link_fuzzy = RegExp(untpl(re.tpl_link_fuzzy), 'i');
  re.link_no_ip_fuzzy = RegExp(untpl(re.tpl_link_no_ip_fuzzy), 'i');
  re.host_fuzzy_test = RegExp(untpl(re.tpl_host_fuzzy_test), 'i');

  //
  // Compile each schema
  //

  const aliases = [];

  self.__compiled__ = {}; // Reset compiled data

  function schemaError (name, val) {
    throw new Error('(LinkifyIt) Invalid schema "' + name + '": ' + val)
  }

  Object.keys(self.__schemas__).forEach(function (name) {
    const val = self.__schemas__[name];

    // skip disabled methods
    if (val === null) { return }

    const compiled = { validate: null, link: null };

    self.__compiled__[name] = compiled;

    if (isObject(val)) {
      if (isRegExp(val.validate)) {
        compiled.validate = createValidator(val.validate);
      } else if (isFunction(val.validate)) {
        compiled.validate = val.validate;
      } else {
        schemaError(name, val);
      }

      if (isFunction(val.normalize)) {
        compiled.normalize = val.normalize;
      } else if (!val.normalize) {
        compiled.normalize = createNormalizer();
      } else {
        schemaError(name, val);
      }

      return
    }

    if (isString(val)) {
      aliases.push(name);
      return
    }

    schemaError(name, val);
  });

  //
  // Compile postponed aliases
  //

  aliases.forEach(function (alias) {
    if (!self.__compiled__[self.__schemas__[alias]]) {
      // Silently fail on missed schemas to avoid errons on disable.
      // schemaError(alias, self.__schemas__[alias]);
      return
    }

    self.__compiled__[alias].validate =
      self.__compiled__[self.__schemas__[alias]].validate;
    self.__compiled__[alias].normalize =
      self.__compiled__[self.__schemas__[alias]].normalize;
  });

  //
  // Fake record for guessed links
  //
  self.__compiled__[''] = { validate: null, normalize: createNormalizer() };

  //
  // Build schema condition
  //
  const slist = Object.keys(self.__compiled__)
    .filter(function (name) {
      // Filter disabled & fake schemas
      return name.length > 0 && self.__compiled__[name]
    })
    .map(escapeRE)
    .join('|');
  // (?!_) cause 1.5x slowdown
  self.re.schema_test = RegExp('(^|(?!_)(?:[><\uff5c]|' + re.src_ZPCc + '))(' + slist + ')', 'i');
  self.re.schema_search = RegExp('(^|(?!_)(?:[><\uff5c]|' + re.src_ZPCc + '))(' + slist + ')', 'ig');
  self.re.schema_at_start = RegExp('^' + self.re.schema_search.source, 'i');

  self.re.pretest = RegExp(
    '(' + self.re.schema_test.source + ')|(' + self.re.host_fuzzy_test.source + ')|@',
    'i'
  );

  //
  // Cleanup
  //

  resetScanCache(self);
}

/**
 * class Match
 *
 * Match result. Single element of array, returned by [[LinkifyIt#match]]
 **/
function Match (self, shift) {
  const start = self.__index__;
  const end = self.__last_index__;
  const text = self.__text_cache__.slice(start, end);

  /**
   * Match#schema -> String
   *
   * Prefix (protocol) for matched string.
   **/
  this.schema = self.__schema__.toLowerCase();
  /**
   * Match#index -> Number
   *
   * First position of matched string.
   **/
  this.index = start + shift;
  /**
   * Match#lastIndex -> Number
   *
   * Next position after matched string.
   **/
  this.lastIndex = end + shift;
  /**
   * Match#raw -> String
   *
   * Matched string.
   **/
  this.raw = text;
  /**
   * Match#text -> String
   *
   * Notmalized text of matched string.
   **/
  this.text = text;
  /**
   * Match#url -> String
   *
   * Normalized url of matched string.
   **/
  this.url = text;
}

function createMatch (self, shift) {
  const match = new Match(self, shift);

  self.__compiled__[match.schema].normalize(match, self);

  return match
}

/**
 * class LinkifyIt
 **/

/**
 * new LinkifyIt(schemas, options)
 * - schemas (Object): Optional. Additional schemas to validate (prefix/validator)
 * - options (Object): { fuzzyLink|fuzzyEmail|fuzzyIP: true|false }
 *
 * Creates new linkifier instance with optional additional schemas.
 * Can be called without `new` keyword for convenience.
 *
 * By default understands:
 *
 * - `http(s)://...` , `ftp://...`, `mailto:...` & `//...` links
 * - "fuzzy" links and emails (example.com, foo@bar.com).
 *
 * `schemas` is an object, where each key/value describes protocol/rule:
 *
 * - __key__ - link prefix (usually, protocol name with `:` at the end, `skype:`
 *   for example). `linkify-it` makes shure that prefix is not preceeded with
 *   alphanumeric char and symbols. Only whitespaces and punctuation allowed.
 * - __value__ - rule to check tail after link prefix
 *   - _String_ - just alias to existing rule
 *   - _Object_
 *     - _validate_ - validator function (should return matched length on success),
 *       or `RegExp`.
 *     - _normalize_ - optional function to normalize text & url of matched result
 *       (for example, for @twitter mentions).
 *
 * `options`:
 *
 * - __fuzzyLink__ - recognige URL-s without `http(s):` prefix. Default `true`.
 * - __fuzzyIP__ - allow IPs in fuzzy links above. Can conflict with some texts
 *   like version numbers. Default `false`.
 * - __fuzzyEmail__ - recognize emails without `mailto:` prefix.
 *
 **/
function LinkifyIt (schemas, options) {
  if (!(this instanceof LinkifyIt)) {
    return new LinkifyIt(schemas, options)
  }

  if (!options) {
    if (isOptionsObj(schemas)) {
      options = schemas;
      schemas = {};
    }
  }

  this.__opts__ = assign({}, defaultOptions, options);

  // Cache last tested result. Used to skip repeating steps on next `match` call.
  this.__index__ = -1;
  this.__last_index__ = -1; // Next scan position
  this.__schema__ = '';
  this.__text_cache__ = '';

  this.__schemas__ = assign({}, defaultSchemas, schemas);
  this.__compiled__ = {};

  this.__tlds__ = tlds_default;
  this.__tlds_replaced__ = false;

  this.re = {};

  compile(this);
}

/** chainable
 * LinkifyIt#add(schema, definition)
 * - schema (String): rule name (fixed pattern prefix)
 * - definition (String|RegExp|Object): schema definition
 *
 * Add new rule definition. See constructor description for details.
 **/
LinkifyIt.prototype.add = function add (schema, definition) {
  this.__schemas__[schema] = definition;
  compile(this);
  return this
};

/** chainable
 * LinkifyIt#set(options)
 * - options (Object): { fuzzyLink|fuzzyEmail|fuzzyIP: true|false }
 *
 * Set recognition options for links without schema.
 **/
LinkifyIt.prototype.set = function set (options) {
  this.__opts__ = assign(this.__opts__, options);
  return this
};

/**
 * LinkifyIt#test(text) -> Boolean
 *
 * Searches linkifiable pattern and returns `true` on success or `false` on fail.
 **/
LinkifyIt.prototype.test = function test (text) {
  // Reset scan cache
  this.__text_cache__ = text;
  this.__index__ = -1;

  if (!text.length) { return false }

  let m, ml, me, len, shift, next, re, tld_pos, at_pos;

  // try to scan for link with schema - that's the most simple rule
  if (this.re.schema_test.test(text)) {
    re = this.re.schema_search;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      len = this.testSchemaAt(text, m[2], re.lastIndex);
      if (len) {
        this.__schema__ = m[2];
        this.__index__ = m.index + m[1].length;
        this.__last_index__ = m.index + m[0].length + len;
        break
      }
    }
  }

  if (this.__opts__.fuzzyLink && this.__compiled__['http:']) {
    // guess schemaless links
    tld_pos = text.search(this.re.host_fuzzy_test);
    if (tld_pos >= 0) {
      // if tld is located after found link - no need to check fuzzy pattern
      if (this.__index__ < 0 || tld_pos < this.__index__) {
        if ((ml = text.match(this.__opts__.fuzzyIP ? this.re.link_fuzzy : this.re.link_no_ip_fuzzy)) !== null) {
          shift = ml.index + ml[1].length;

          if (this.__index__ < 0 || shift < this.__index__) {
            this.__schema__ = '';
            this.__index__ = shift;
            this.__last_index__ = ml.index + ml[0].length;
          }
        }
      }
    }
  }

  if (this.__opts__.fuzzyEmail && this.__compiled__['mailto:']) {
    // guess schemaless emails
    at_pos = text.indexOf('@');
    if (at_pos >= 0) {
      // We can't skip this check, because this cases are possible:
      // 192.168.1.1@gmail.com, my.in@example.com
      if ((me = text.match(this.re.email_fuzzy)) !== null) {
        shift = me.index + me[1].length;
        next = me.index + me[0].length;

        if (this.__index__ < 0 || shift < this.__index__ ||
            (shift === this.__index__ && next > this.__last_index__)) {
          this.__schema__ = 'mailto:';
          this.__index__ = shift;
          this.__last_index__ = next;
        }
      }
    }
  }

  return this.__index__ >= 0
};

/**
 * LinkifyIt#pretest(text) -> Boolean
 *
 * Very quick check, that can give false positives. Returns true if link MAY BE
 * can exists. Can be used for speed optimization, when you need to check that
 * link NOT exists.
 **/
LinkifyIt.prototype.pretest = function pretest (text) {
  return this.re.pretest.test(text)
};

/**
 * LinkifyIt#testSchemaAt(text, name, position) -> Number
 * - text (String): text to scan
 * - name (String): rule (schema) name
 * - position (Number): text offset to check from
 *
 * Similar to [[LinkifyIt#test]] but checks only specific protocol tail exactly
 * at given position. Returns length of found pattern (0 on fail).
 **/
LinkifyIt.prototype.testSchemaAt = function testSchemaAt (text, schema, pos) {
  // If not supported schema check requested - terminate
  if (!this.__compiled__[schema.toLowerCase()]) {
    return 0
  }
  return this.__compiled__[schema.toLowerCase()].validate(text, pos, this)
};

/**
 * LinkifyIt#match(text) -> Array|null
 *
 * Returns array of found link descriptions or `null` on fail. We strongly
 * recommend to use [[LinkifyIt#test]] first, for best speed.
 *
 * ##### Result match description
 *
 * - __schema__ - link schema, can be empty for fuzzy links, or `//` for
 *   protocol-neutral  links.
 * - __index__ - offset of matched text
 * - __lastIndex__ - index of next char after mathch end
 * - __raw__ - matched text
 * - __text__ - normalized text
 * - __url__ - link, generated from matched text
 **/
LinkifyIt.prototype.match = function match (text) {
  const result = [];
  let shift = 0;

  // Try to take previous element from cache, if .test() called before
  if (this.__index__ >= 0 && this.__text_cache__ === text) {
    result.push(createMatch(this, shift));
    shift = this.__last_index__;
  }

  // Cut head if cache was used
  let tail = shift ? text.slice(shift) : text;

  // Scan string until end reached
  while (this.test(tail)) {
    result.push(createMatch(this, shift));

    tail = tail.slice(this.__last_index__);
    shift += this.__last_index__;
  }

  if (result.length) {
    return result
  }

  return null
};

/**
 * LinkifyIt#matchAtStart(text) -> Match|null
 *
 * Returns fully-formed (not fuzzy) link if it starts at the beginning
 * of the string, and null otherwise.
 **/
LinkifyIt.prototype.matchAtStart = function matchAtStart (text) {
  // Reset scan cache
  this.__text_cache__ = text;
  this.__index__ = -1;

  if (!text.length) return null

  const m = this.re.schema_at_start.exec(text);
  if (!m) return null

  const len = this.testSchemaAt(text, m[2], m[0].length);
  if (!len) return null

  this.__schema__ = m[2];
  this.__index__ = m.index + m[1].length;
  this.__last_index__ = m.index + m[0].length + len;

  return createMatch(this, 0)
};

/** chainable
 * LinkifyIt#tlds(list [, keepOld]) -> this
 * - list (Array): list of tlds
 * - keepOld (Boolean): merge with current list if `true` (`false` by default)
 *
 * Load (or merge) new tlds list. Those are user for fuzzy links (without prefix)
 * to avoid false positives. By default this algorythm used:
 *
 * - hostname with any 2-letter root zones are ok.
 * - biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф
 *   are ok.
 * - encoded (`xn--...`) root zones are ok.
 *
 * If list is replaced, then exact match for 2-chars root zones will be checked.
 **/
LinkifyIt.prototype.tlds = function tlds (list, keepOld) {
  list = Array.isArray(list) ? list : [list];

  if (!keepOld) {
    this.__tlds__ = list.slice();
    this.__tlds_replaced__ = true;
    compile(this);
    return this
  }

  this.__tlds__ = this.__tlds__.concat(list)
    .sort()
    .filter(function (el, idx, arr) {
      return el !== arr[idx - 1]
    })
    .reverse();

  compile(this);
  return this
};

/**
 * LinkifyIt#normalize(match)
 *
 * Default normalizer (if schema does not define it's own).
 **/
LinkifyIt.prototype.normalize = function normalize (match) {
  // Do minimal possible changes by default. Need to collect feedback prior
  // to move forward https://github.com/markdown-it/linkify-it/issues/1

  if (!match.schema) { match.url = 'http://' + match.url; }

  if (match.schema === 'mailto:' && !/^mailto:/i.test(match.url)) {
    match.url = 'mailto:' + match.url;
  }
};

/**
 * LinkifyIt#onCompile()
 *
 * Override to modify basic RegExp-s.
 **/
LinkifyIt.prototype.onCompile = function onCompile () {
};

/** Highest positive signed 32-bit float value */
const maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1

/** Bootstring parameters */
const base = 36;
const tMin = 1;
const tMax = 26;
const skew = 38;
const damp = 700;
const initialBias = 72;
const initialN = 128; // 0x80
const delimiter = '-'; // '\x2D'

/** Regular expressions */
const regexPunycode = /^xn--/;
const regexNonASCII = /[^\0-\x7F]/; // Note: U+007F DEL is excluded too.
const regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g; // RFC 3490 separators

/** Error messages */
const errors = {
	'overflow': 'Overflow: input needs wider integers to process',
	'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
	'invalid-input': 'Invalid input'
};

/** Convenience shortcuts */
const baseMinusTMin = base - tMin;
const floor = Math.floor;
const stringFromCharCode = String.fromCharCode;

/*--------------------------------------------------------------------------*/

/**
 * A generic error utility function.
 * @private
 * @param {String} type The error type.
 * @returns {Error} Throws a `RangeError` with the applicable error message.
 */
function error(type) {
	throw new RangeError(errors[type]);
}

/**
 * A generic `Array#map` utility function.
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} callback The function that gets called for every array
 * item.
 * @returns {Array} A new array of values returned by the callback function.
 */
function map(array, callback) {
	const result = [];
	let length = array.length;
	while (length--) {
		result[length] = callback(array[length]);
	}
	return result;
}

/**
 * A simple `Array#map`-like wrapper to work with domain name strings or email
 * addresses.
 * @private
 * @param {String} domain The domain name or email address.
 * @param {Function} callback The function that gets called for every
 * character.
 * @returns {String} A new string of characters returned by the callback
 * function.
 */
function mapDomain(domain, callback) {
	const parts = domain.split('@');
	let result = '';
	if (parts.length > 1) {
		// In email addresses, only the domain name should be punycoded. Leave
		// the local part (i.e. everything up to `@`) intact.
		result = parts[0] + '@';
		domain = parts[1];
	}
	// Avoid `split(regex)` for IE8 compatibility. See #17.
	domain = domain.replace(regexSeparators, '\x2E');
	const labels = domain.split('.');
	const encoded = map(labels, callback).join('.');
	return result + encoded;
}

/**
 * Creates an array containing the numeric code points of each Unicode
 * character in the string. While JavaScript uses UCS-2 internally,
 * this function will convert a pair of surrogate halves (each of which
 * UCS-2 exposes as separate characters) into a single code point,
 * matching UTF-16.
 * @see `punycode.ucs2.encode`
 * @see <https://mathiasbynens.be/notes/javascript-encoding>
 * @memberOf punycode.ucs2
 * @name decode
 * @param {String} string The Unicode input string (UCS-2).
 * @returns {Array} The new array of code points.
 */
function ucs2decode(string) {
	const output = [];
	let counter = 0;
	const length = string.length;
	while (counter < length) {
		const value = string.charCodeAt(counter++);
		if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
			// It's a high surrogate, and there is a next character.
			const extra = string.charCodeAt(counter++);
			if ((extra & 0xFC00) == 0xDC00) { // Low surrogate.
				output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
			} else {
				// It's an unmatched surrogate; only append this code unit, in case the
				// next code unit is the high surrogate of a surrogate pair.
				output.push(value);
				counter--;
			}
		} else {
			output.push(value);
		}
	}
	return output;
}

/**
 * Creates a string based on an array of numeric code points.
 * @see `punycode.ucs2.decode`
 * @memberOf punycode.ucs2
 * @name encode
 * @param {Array} codePoints The array of numeric code points.
 * @returns {String} The new Unicode string (UCS-2).
 */
const ucs2encode = codePoints => String.fromCodePoint(...codePoints);

/**
 * Converts a basic code point into a digit/integer.
 * @see `digitToBasic()`
 * @private
 * @param {Number} codePoint The basic numeric code point value.
 * @returns {Number} The numeric value of a basic code point (for use in
 * representing integers) in the range `0` to `base - 1`, or `base` if
 * the code point does not represent a value.
 */
const basicToDigit = function(codePoint) {
	if (codePoint >= 0x30 && codePoint < 0x3A) {
		return 26 + (codePoint - 0x30);
	}
	if (codePoint >= 0x41 && codePoint < 0x5B) {
		return codePoint - 0x41;
	}
	if (codePoint >= 0x61 && codePoint < 0x7B) {
		return codePoint - 0x61;
	}
	return base;
};

/**
 * Converts a digit/integer into a basic code point.
 * @see `basicToDigit()`
 * @private
 * @param {Number} digit The numeric value of a basic code point.
 * @returns {Number} The basic code point whose value (when used for
 * representing integers) is `digit`, which needs to be in the range
 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
 * used; else, the lowercase form is used. The behavior is undefined
 * if `flag` is non-zero and `digit` has no uppercase form.
 */
const digitToBasic = function(digit, flag) {
	//  0..25 map to ASCII a..z or A..Z
	// 26..35 map to ASCII 0..9
	return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
};

/**
 * Bias adaptation function as per section 3.4 of RFC 3492.
 * https://tools.ietf.org/html/rfc3492#section-3.4
 * @private
 */
const adapt = function(delta, numPoints, firstTime) {
	let k = 0;
	delta = firstTime ? floor(delta / damp) : delta >> 1;
	delta += floor(delta / numPoints);
	for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
		delta = floor(delta / baseMinusTMin);
	}
	return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
};

/**
 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
 * symbols.
 * @memberOf punycode
 * @param {String} input The Punycode string of ASCII-only symbols.
 * @returns {String} The resulting string of Unicode symbols.
 */
const decode = function(input) {
	// Don't use UCS-2.
	const output = [];
	const inputLength = input.length;
	let i = 0;
	let n = initialN;
	let bias = initialBias;

	// Handle the basic code points: let `basic` be the number of input code
	// points before the last delimiter, or `0` if there is none, then copy
	// the first basic code points to the output.

	let basic = input.lastIndexOf(delimiter);
	if (basic < 0) {
		basic = 0;
	}

	for (let j = 0; j < basic; ++j) {
		// if it's not a basic code point
		if (input.charCodeAt(j) >= 0x80) {
			error('not-basic');
		}
		output.push(input.charCodeAt(j));
	}

	// Main decoding loop: start just after the last delimiter if any basic code
	// points were copied; start at the beginning otherwise.

	for (let index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

		// `index` is the index of the next character to be consumed.
		// Decode a generalized variable-length integer into `delta`,
		// which gets added to `i`. The overflow checking is easier
		// if we increase `i` as we go, then subtract off its starting
		// value at the end to obtain `delta`.
		const oldi = i;
		for (let w = 1, k = base; /* no condition */; k += base) {

			if (index >= inputLength) {
				error('invalid-input');
			}

			const digit = basicToDigit(input.charCodeAt(index++));

			if (digit >= base) {
				error('invalid-input');
			}
			if (digit > floor((maxInt - i) / w)) {
				error('overflow');
			}

			i += digit * w;
			const t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

			if (digit < t) {
				break;
			}

			const baseMinusT = base - t;
			if (w > floor(maxInt / baseMinusT)) {
				error('overflow');
			}

			w *= baseMinusT;

		}

		const out = output.length + 1;
		bias = adapt(i - oldi, out, oldi == 0);

		// `i` was supposed to wrap around from `out` to `0`,
		// incrementing `n` each time, so we'll fix that now:
		if (floor(i / out) > maxInt - n) {
			error('overflow');
		}

		n += floor(i / out);
		i %= out;

		// Insert `n` at position `i` of the output.
		output.splice(i++, 0, n);

	}

	return String.fromCodePoint(...output);
};

/**
 * Converts a string of Unicode symbols (e.g. a domain name label) to a
 * Punycode string of ASCII-only symbols.
 * @memberOf punycode
 * @param {String} input The string of Unicode symbols.
 * @returns {String} The resulting Punycode string of ASCII-only symbols.
 */
const encode = function(input) {
	const output = [];

	// Convert the input in UCS-2 to an array of Unicode code points.
	input = ucs2decode(input);

	// Cache the length.
	const inputLength = input.length;

	// Initialize the state.
	let n = initialN;
	let delta = 0;
	let bias = initialBias;

	// Handle the basic code points.
	for (const currentValue of input) {
		if (currentValue < 0x80) {
			output.push(stringFromCharCode(currentValue));
		}
	}

	const basicLength = output.length;
	let handledCPCount = basicLength;

	// `handledCPCount` is the number of code points that have been handled;
	// `basicLength` is the number of basic code points.

	// Finish the basic string with a delimiter unless it's empty.
	if (basicLength) {
		output.push(delimiter);
	}

	// Main encoding loop:
	while (handledCPCount < inputLength) {

		// All non-basic code points < n have been handled already. Find the next
		// larger one:
		let m = maxInt;
		for (const currentValue of input) {
			if (currentValue >= n && currentValue < m) {
				m = currentValue;
			}
		}

		// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
		// but guard against overflow.
		const handledCPCountPlusOne = handledCPCount + 1;
		if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
			error('overflow');
		}

		delta += (m - n) * handledCPCountPlusOne;
		n = m;

		for (const currentValue of input) {
			if (currentValue < n && ++delta > maxInt) {
				error('overflow');
			}
			if (currentValue === n) {
				// Represent delta as a generalized variable-length integer.
				let q = delta;
				for (let k = base; /* no condition */; k += base) {
					const t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
					if (q < t) {
						break;
					}
					const qMinusT = q - t;
					const baseMinusT = base - t;
					output.push(
						stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
					);
					q = floor(qMinusT / baseMinusT);
				}

				output.push(stringFromCharCode(digitToBasic(q, 0)));
				bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
				delta = 0;
				++handledCPCount;
			}
		}

		++delta;
		++n;

	}
	return output.join('');
};

/**
 * Converts a Punycode string representing a domain name or an email address
 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
 * it doesn't matter if you call it on a string that has already been
 * converted to Unicode.
 * @memberOf punycode
 * @param {String} input The Punycoded domain name or email address to
 * convert to Unicode.
 * @returns {String} The Unicode representation of the given Punycode
 * string.
 */
const toUnicode = function(input) {
	return mapDomain(input, function(string) {
		return regexPunycode.test(string)
			? decode(string.slice(4).toLowerCase())
			: string;
	});
};

/**
 * Converts a Unicode string representing a domain name or an email address to
 * Punycode. Only the non-ASCII parts of the domain name will be converted,
 * i.e. it doesn't matter if you call it with a domain that's already in
 * ASCII.
 * @memberOf punycode
 * @param {String} input The domain name or email address to convert, as a
 * Unicode string.
 * @returns {String} The Punycode representation of the given domain name or
 * email address.
 */
const toASCII = function(input) {
	return mapDomain(input, function(string) {
		return regexNonASCII.test(string)
			? 'xn--' + encode(string)
			: string;
	});
};

/*--------------------------------------------------------------------------*/

/** Define the public API */
const punycode = {
	/**
	 * A string representing the current Punycode.js version number.
	 * @memberOf punycode
	 * @type String
	 */
	'version': '2.3.1',
	/**
	 * An object of methods to convert from JavaScript's internal character
	 * representation (UCS-2) to Unicode code points, and back.
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode
	 * @type Object
	 */
	'ucs2': {
		'decode': ucs2decode,
		'encode': ucs2encode
	},
	'decode': decode,
	'encode': encode,
	'toASCII': toASCII,
	'toUnicode': toUnicode
};

// markdown-it default options

var cfg_default = {
  options: {
    // Enable HTML tags in source
    html: false,

    // Use '/' to close single tags (<br />)
    xhtmlOut: false,

    // Convert '\n' in paragraphs into <br>
    breaks: false,

    // CSS language prefix for fenced blocks
    langPrefix: 'language-',

    // autoconvert URL-like texts to links
    linkify: false,

    // Enable some language-neutral replacements + quotes beautification
    typographer: false,

    // Double + single quotes replacement pairs, when typographer enabled,
    // and smartquotes on. Could be either a String or an Array.
    //
    // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
    // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
    quotes: '\u201c\u201d\u2018\u2019', /* “”‘’ */

    // Highlighter function. Should return escaped HTML,
    // or '' if the source string is not changed and should be escaped externaly.
    // If result starts with <pre... internal wrapper is skipped.
    //
    // function (/*str, lang*/) { return ''; }
    //
    highlight: null,

    // Internal protection, recursion limit
    maxNesting: 100
  },

  components: {
    core: {},
    block: {},
    inline: {}
  }
};

// "Zero" preset, with nothing enabled. Useful for manual configuring of simple
// modes. For example, to parse bold/italic only.

var cfg_zero = {
  options: {
    // Enable HTML tags in source
    html: false,

    // Use '/' to close single tags (<br />)
    xhtmlOut: false,

    // Convert '\n' in paragraphs into <br>
    breaks: false,

    // CSS language prefix for fenced blocks
    langPrefix: 'language-',

    // autoconvert URL-like texts to links
    linkify: false,

    // Enable some language-neutral replacements + quotes beautification
    typographer: false,

    // Double + single quotes replacement pairs, when typographer enabled,
    // and smartquotes on. Could be either a String or an Array.
    //
    // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
    // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
    quotes: '\u201c\u201d\u2018\u2019', /* “”‘’ */

    // Highlighter function. Should return escaped HTML,
    // or '' if the source string is not changed and should be escaped externaly.
    // If result starts with <pre... internal wrapper is skipped.
    //
    // function (/*str, lang*/) { return ''; }
    //
    highlight: null,

    // Internal protection, recursion limit
    maxNesting: 20
  },

  components: {

    core: {
      rules: [
        'normalize',
        'block',
        'inline',
        'text_join'
      ]
    },

    block: {
      rules: [
        'paragraph'
      ]
    },

    inline: {
      rules: [
        'text'
      ],
      rules2: [
        'balance_pairs',
        'fragments_join'
      ]
    }
  }
};

// Commonmark default options

var cfg_commonmark = {
  options: {
    // Enable HTML tags in source
    html: true,

    // Use '/' to close single tags (<br />)
    xhtmlOut: true,

    // Convert '\n' in paragraphs into <br>
    breaks: false,

    // CSS language prefix for fenced blocks
    langPrefix: 'language-',

    // autoconvert URL-like texts to links
    linkify: false,

    // Enable some language-neutral replacements + quotes beautification
    typographer: false,

    // Double + single quotes replacement pairs, when typographer enabled,
    // and smartquotes on. Could be either a String or an Array.
    //
    // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
    // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
    quotes: '\u201c\u201d\u2018\u2019', /* “”‘’ */

    // Highlighter function. Should return escaped HTML,
    // or '' if the source string is not changed and should be escaped externaly.
    // If result starts with <pre... internal wrapper is skipped.
    //
    // function (/*str, lang*/) { return ''; }
    //
    highlight: null,

    // Internal protection, recursion limit
    maxNesting: 20
  },

  components: {

    core: {
      rules: [
        'normalize',
        'block',
        'inline',
        'text_join'
      ]
    },

    block: {
      rules: [
        'blockquote',
        'code',
        'fence',
        'heading',
        'hr',
        'html_block',
        'lheading',
        'list',
        'reference',
        'paragraph'
      ]
    },

    inline: {
      rules: [
        'autolink',
        'backticks',
        'emphasis',
        'entity',
        'escape',
        'html_inline',
        'image',
        'link',
        'newline',
        'text'
      ],
      rules2: [
        'balance_pairs',
        'emphasis',
        'fragments_join'
      ]
    }
  }
};

// Main parser class


const config = {
  default: cfg_default,
  zero: cfg_zero,
  commonmark: cfg_commonmark
};

//
// This validator can prohibit more than really needed to prevent XSS. It's a
// tradeoff to keep code simple and to be secure by default.
//
// If you need different setup - override validator method as you wish. Or
// replace it with dummy function and use external sanitizer.
//

const BAD_PROTO_RE = /^(vbscript|javascript|file|data):/;
const GOOD_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/;

function validateLink (url) {
  // url should be normalized at this point, and existing entities are decoded
  const str = url.trim().toLowerCase();

  return BAD_PROTO_RE.test(str) ? GOOD_DATA_RE.test(str) : true
}

const RECODE_HOSTNAME_FOR = ['http:', 'https:', 'mailto:'];

function normalizeLink (url) {
  const parsed = urlParse(url, true);

  if (parsed.hostname) {
    // Encode hostnames in urls like:
    // `http://host/`, `https://host/`, `mailto:user@host`, `//host/`
    //
    // We don't encode unknown schemas, because it's likely that we encode
    // something we shouldn't (e.g. `skype:name` treated as `skype:host`)
    //
    if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
      try {
        parsed.hostname = punycode.toASCII(parsed.hostname);
      } catch (er) { /**/ }
    }
  }

  return encode$1(format(parsed))
}

function normalizeLinkText (url) {
  const parsed = urlParse(url, true);

  if (parsed.hostname) {
    // Encode hostnames in urls like:
    // `http://host/`, `https://host/`, `mailto:user@host`, `//host/`
    //
    // We don't encode unknown schemas, because it's likely that we encode
    // something we shouldn't (e.g. `skype:name` treated as `skype:host`)
    //
    if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
      try {
        parsed.hostname = punycode.toUnicode(parsed.hostname);
      } catch (er) { /**/ }
    }
  }

  // add '%' to exclude list because of https://github.com/markdown-it/markdown-it/issues/720
  return decode$1(format(parsed), decode$1.defaultChars + '%')
}

/**
 * class MarkdownIt
 *
 * Main parser/renderer class.
 *
 * ##### Usage
 *
 * ```javascript
 * // node.js, "classic" way:
 * var MarkdownIt = require('markdown-it'),
 *     md = new MarkdownIt();
 * var result = md.render('# markdown-it rulezz!');
 *
 * // node.js, the same, but with sugar:
 * var md = require('markdown-it')();
 * var result = md.render('# markdown-it rulezz!');
 *
 * // browser without AMD, added to "window" on script load
 * // Note, there are no dash.
 * var md = window.markdownit();
 * var result = md.render('# markdown-it rulezz!');
 * ```
 *
 * Single line rendering, without paragraph wrap:
 *
 * ```javascript
 * var md = require('markdown-it')();
 * var result = md.renderInline('__markdown-it__ rulezz!');
 * ```
 **/

/**
 * new MarkdownIt([presetName, options])
 * - presetName (String): optional, `commonmark` / `zero`
 * - options (Object)
 *
 * Creates parser instanse with given config. Can be called without `new`.
 *
 * ##### presetName
 *
 * MarkdownIt provides named presets as a convenience to quickly
 * enable/disable active syntax rules and options for common use cases.
 *
 * - ["commonmark"](https://github.com/markdown-it/markdown-it/blob/master/lib/presets/commonmark.mjs) -
 *   configures parser to strict [CommonMark](http://commonmark.org/) mode.
 * - [default](https://github.com/markdown-it/markdown-it/blob/master/lib/presets/default.mjs) -
 *   similar to GFM, used when no preset name given. Enables all available rules,
 *   but still without html, typographer & autolinker.
 * - ["zero"](https://github.com/markdown-it/markdown-it/blob/master/lib/presets/zero.mjs) -
 *   all rules disabled. Useful to quickly setup your config via `.enable()`.
 *   For example, when you need only `bold` and `italic` markup and nothing else.
 *
 * ##### options:
 *
 * - __html__ - `false`. Set `true` to enable HTML tags in source. Be careful!
 *   That's not safe! You may need external sanitizer to protect output from XSS.
 *   It's better to extend features via plugins, instead of enabling HTML.
 * - __xhtmlOut__ - `false`. Set `true` to add '/' when closing single tags
 *   (`<br />`). This is needed only for full CommonMark compatibility. In real
 *   world you will need HTML output.
 * - __breaks__ - `false`. Set `true` to convert `\n` in paragraphs into `<br>`.
 * - __langPrefix__ - `language-`. CSS language class prefix for fenced blocks.
 *   Can be useful for external highlighters.
 * - __linkify__ - `false`. Set `true` to autoconvert URL-like text to links.
 * - __typographer__  - `false`. Set `true` to enable [some language-neutral
 *   replacement](https://github.com/markdown-it/markdown-it/blob/master/lib/rules_core/replacements.mjs) +
 *   quotes beautification (smartquotes).
 * - __quotes__ - `“”‘’`, String or Array. Double + single quotes replacement
 *   pairs, when typographer enabled and smartquotes on. For example, you can
 *   use `'«»„“'` for Russian, `'„“‚‘'` for German, and
 *   `['«\xA0', '\xA0»', '‹\xA0', '\xA0›']` for French (including nbsp).
 * - __highlight__ - `null`. Highlighter function for fenced code blocks.
 *   Highlighter `function (str, lang)` should return escaped HTML. It can also
 *   return empty string if the source was not changed and should be escaped
 *   externaly. If result starts with <pre... internal wrapper is skipped.
 *
 * ##### Example
 *
 * ```javascript
 * // commonmark mode
 * var md = require('markdown-it')('commonmark');
 *
 * // default mode
 * var md = require('markdown-it')();
 *
 * // enable everything
 * var md = require('markdown-it')({
 *   html: true,
 *   linkify: true,
 *   typographer: true
 * });
 * ```
 *
 * ##### Syntax highlighting
 *
 * ```js
 * var hljs = require('highlight.js') // https://highlightjs.org/
 *
 * var md = require('markdown-it')({
 *   highlight: function (str, lang) {
 *     if (lang && hljs.getLanguage(lang)) {
 *       try {
 *         return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
 *       } catch (__) {}
 *     }
 *
 *     return ''; // use external default escaping
 *   }
 * });
 * ```
 *
 * Or with full wrapper override (if you need assign class to `<pre>` or `<code>`):
 *
 * ```javascript
 * var hljs = require('highlight.js') // https://highlightjs.org/
 *
 * // Actual default values
 * var md = require('markdown-it')({
 *   highlight: function (str, lang) {
 *     if (lang && hljs.getLanguage(lang)) {
 *       try {
 *         return '<pre><code class="hljs">' +
 *                hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
 *                '</code></pre>';
 *       } catch (__) {}
 *     }
 *
 *     return '<pre><code class="hljs">' + md.utils.escapeHtml(str) + '</code></pre>';
 *   }
 * });
 * ```
 *
 **/
function MarkdownIt (presetName, options) {
  if (!(this instanceof MarkdownIt)) {
    return new MarkdownIt(presetName, options)
  }

  if (!options) {
    if (!isString$1(presetName)) {
      options = presetName || {};
      presetName = 'default';
    }
  }

  /**
   * MarkdownIt#inline -> ParserInline
   *
   * Instance of [[ParserInline]]. You may need it to add new rules when
   * writing plugins. For simple rules control use [[MarkdownIt.disable]] and
   * [[MarkdownIt.enable]].
   **/
  this.inline = new ParserInline();

  /**
   * MarkdownIt#block -> ParserBlock
   *
   * Instance of [[ParserBlock]]. You may need it to add new rules when
   * writing plugins. For simple rules control use [[MarkdownIt.disable]] and
   * [[MarkdownIt.enable]].
   **/
  this.block = new ParserBlock();

  /**
   * MarkdownIt#core -> Core
   *
   * Instance of [[Core]] chain executor. You may need it to add new rules when
   * writing plugins. For simple rules control use [[MarkdownIt.disable]] and
   * [[MarkdownIt.enable]].
   **/
  this.core = new Core();

  /**
   * MarkdownIt#renderer -> Renderer
   *
   * Instance of [[Renderer]]. Use it to modify output look. Or to add rendering
   * rules for new token types, generated by plugins.
   *
   * ##### Example
   *
   * ```javascript
   * var md = require('markdown-it')();
   *
   * function myToken(tokens, idx, options, env, self) {
   *   //...
   *   return result;
   * };
   *
   * md.renderer.rules['my_token'] = myToken
   * ```
   *
   * See [[Renderer]] docs and [source code](https://github.com/markdown-it/markdown-it/blob/master/lib/renderer.mjs).
   **/
  this.renderer = new Renderer$1();

  /**
   * MarkdownIt#linkify -> LinkifyIt
   *
   * [linkify-it](https://github.com/markdown-it/linkify-it) instance.
   * Used by [linkify](https://github.com/markdown-it/markdown-it/blob/master/lib/rules_core/linkify.mjs)
   * rule.
   **/
  this.linkify = new LinkifyIt();

  /**
   * MarkdownIt#validateLink(url) -> Boolean
   *
   * Link validation function. CommonMark allows too much in links. By default
   * we disable `javascript:`, `vbscript:`, `file:` schemas, and almost all `data:...` schemas
   * except some embedded image types.
   *
   * You can change this behaviour:
   *
   * ```javascript
   * var md = require('markdown-it')();
   * // enable everything
   * md.validateLink = function () { return true; }
   * ```
   **/
  this.validateLink = validateLink;

  /**
   * MarkdownIt#normalizeLink(url) -> String
   *
   * Function used to encode link url to a machine-readable format,
   * which includes url-encoding, punycode, etc.
   **/
  this.normalizeLink = normalizeLink;

  /**
   * MarkdownIt#normalizeLinkText(url) -> String
   *
   * Function used to decode link url to a human-readable format`
   **/
  this.normalizeLinkText = normalizeLinkText;

  // Expose utils & helpers for easy acces from plugins

  /**
   * MarkdownIt#utils -> utils
   *
   * Assorted utility functions, useful to write plugins. See details
   * [here](https://github.com/markdown-it/markdown-it/blob/master/lib/common/utils.mjs).
   **/
  this.utils = utils;

  /**
   * MarkdownIt#helpers -> helpers
   *
   * Link components parser functions, useful to write plugins. See details
   * [here](https://github.com/markdown-it/markdown-it/blob/master/lib/helpers).
   **/
  this.helpers = assign$1({}, helpers);

  this.options = {};
  this.configure(presetName);

  if (options) { this.set(options); }
}

/** chainable
 * MarkdownIt.set(options)
 *
 * Set parser options (in the same format as in constructor). Probably, you
 * will never need it, but you can change options after constructor call.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')()
 *             .set({ html: true, breaks: true })
 *             .set({ typographer, true });
 * ```
 *
 * __Note:__ To achieve the best possible performance, don't modify a
 * `markdown-it` instance options on the fly. If you need multiple configurations
 * it's best to create multiple instances and initialize each with separate
 * config.
 **/
MarkdownIt.prototype.set = function (options) {
  assign$1(this.options, options);
  return this
};

/** chainable, internal
 * MarkdownIt.configure(presets)
 *
 * Batch load of all options and compenent settings. This is internal method,
 * and you probably will not need it. But if you will - see available presets
 * and data structure [here](https://github.com/markdown-it/markdown-it/tree/master/lib/presets)
 *
 * We strongly recommend to use presets instead of direct config loads. That
 * will give better compatibility with next versions.
 **/
MarkdownIt.prototype.configure = function (presets) {
  const self = this;

  if (isString$1(presets)) {
    const presetName = presets;
    presets = config[presetName];
    if (!presets) { throw new Error('Wrong `markdown-it` preset "' + presetName + '", check name') }
  }

  if (!presets) { throw new Error('Wrong `markdown-it` preset, can\'t be empty') }

  if (presets.options) { self.set(presets.options); }

  if (presets.components) {
    Object.keys(presets.components).forEach(function (name) {
      if (presets.components[name].rules) {
        self[name].ruler.enableOnly(presets.components[name].rules);
      }
      if (presets.components[name].rules2) {
        self[name].ruler2.enableOnly(presets.components[name].rules2);
      }
    });
  }
  return this
};

/** chainable
 * MarkdownIt.enable(list, ignoreInvalid)
 * - list (String|Array): rule name or list of rule names to enable
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * Enable list or rules. It will automatically find appropriate components,
 * containing rules with given names. If rule not found, and `ignoreInvalid`
 * not set - throws exception.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')()
 *             .enable(['sub', 'sup'])
 *             .disable('smartquotes');
 * ```
 **/
MarkdownIt.prototype.enable = function (list, ignoreInvalid) {
  let result = [];

  if (!Array.isArray(list)) { list = [list]; }

  ['core', 'block', 'inline'].forEach(function (chain) {
    result = result.concat(this[chain].ruler.enable(list, true));
  }, this);

  result = result.concat(this.inline.ruler2.enable(list, true));

  const missed = list.filter(function (name) { return result.indexOf(name) < 0 });

  if (missed.length && !ignoreInvalid) {
    throw new Error('MarkdownIt. Failed to enable unknown rule(s): ' + missed)
  }

  return this
};

/** chainable
 * MarkdownIt.disable(list, ignoreInvalid)
 * - list (String|Array): rule name or list of rule names to disable.
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * The same as [[MarkdownIt.enable]], but turn specified rules off.
 **/
MarkdownIt.prototype.disable = function (list, ignoreInvalid) {
  let result = [];

  if (!Array.isArray(list)) { list = [list]; }

  ['core', 'block', 'inline'].forEach(function (chain) {
    result = result.concat(this[chain].ruler.disable(list, true));
  }, this);

  result = result.concat(this.inline.ruler2.disable(list, true));

  const missed = list.filter(function (name) { return result.indexOf(name) < 0 });

  if (missed.length && !ignoreInvalid) {
    throw new Error('MarkdownIt. Failed to disable unknown rule(s): ' + missed)
  }
  return this
};

/** chainable
 * MarkdownIt.use(plugin, params)
 *
 * Load specified plugin with given params into current parser instance.
 * It's just a sugar to call `plugin(md, params)` with curring.
 *
 * ##### Example
 *
 * ```javascript
 * var iterator = require('markdown-it-for-inline');
 * var md = require('markdown-it')()
 *             .use(iterator, 'foo_replace', 'text', function (tokens, idx) {
 *               tokens[idx].content = tokens[idx].content.replace(/foo/g, 'bar');
 *             });
 * ```
 **/
MarkdownIt.prototype.use = function (plugin /*, params, ... */) {
  const args = [this].concat(Array.prototype.slice.call(arguments, 1));
  plugin.apply(plugin, args);
  return this
};

/** internal
 * MarkdownIt.parse(src, env) -> Array
 * - src (String): source string
 * - env (Object): environment sandbox
 *
 * Parse input string and return list of block tokens (special token type
 * "inline" will contain list of inline tokens). You should not call this
 * method directly, until you write custom renderer (for example, to produce
 * AST).
 *
 * `env` is used to pass data between "distributed" rules and return additional
 * metadata like reference info, needed for the renderer. It also can be used to
 * inject data in specific cases. Usually, you will be ok to pass `{}`,
 * and then pass updated object to renderer.
 **/
MarkdownIt.prototype.parse = function (src, env) {
  if (typeof src !== 'string') {
    throw new Error('Input data should be a String')
  }

  const state = new this.core.State(src, this, env);

  this.core.process(state);

  return state.tokens
};

/**
 * MarkdownIt.render(src [, env]) -> String
 * - src (String): source string
 * - env (Object): environment sandbox
 *
 * Render markdown string into html. It does all magic for you :).
 *
 * `env` can be used to inject additional metadata (`{}` by default).
 * But you will not need it with high probability. See also comment
 * in [[MarkdownIt.parse]].
 **/
MarkdownIt.prototype.render = function (src, env) {
  env = env || {};

  return this.renderer.render(this.parse(src, env), this.options, env)
};

/** internal
 * MarkdownIt.parseInline(src, env) -> Array
 * - src (String): source string
 * - env (Object): environment sandbox
 *
 * The same as [[MarkdownIt.parse]] but skip all block rules. It returns the
 * block tokens list with the single `inline` element, containing parsed inline
 * tokens in `children` property. Also updates `env` object.
 **/
MarkdownIt.prototype.parseInline = function (src, env) {
  const state = new this.core.State(src, this, env);

  state.inlineMode = true;
  this.core.process(state);

  return state.tokens
};

/**
 * MarkdownIt.renderInline(src [, env]) -> String
 * - src (String): source string
 * - env (Object): environment sandbox
 *
 * Similar to [[MarkdownIt.render]] but for single paragraph content. Result
 * will NOT be wrapped into `<p>` tags.
 **/
MarkdownIt.prototype.renderInline = function (src, env) {
  env = env || {};

  return this.renderer.render(this.parseInline(src, env), this.options, env)
};

/**
 * Safe JSON parsing with size limits and error handling.
 */
function safeParseJSON(jsonStr, maxSize = 50000) {
    // Check size limit
    if (jsonStr.length > maxSize) {
        return {
            valid: false,
            data: null,
            error: `JSON exceeds maximum size of ${maxSize} bytes (got ${jsonStr.length})`,
        };
    }
    try {
        const data = JSON.parse(jsonStr);
        return { valid: true, data };
    }
    catch (e) {
        return {
            valid: false,
            data: null,
            error: `Invalid JSON: ${e.message}`,
        };
    }
}
/**
 * Extracts the component type and JSON string from a livellm code fence content.
 * Returns null if the format doesn't match.
 */
function parseLiveLLMBlock(info, content) {
    const trimmedInfo = info.trim();
    if (!trimmedInfo.startsWith('livellm:')) {
        return null;
    }
    const type = trimmedInfo.substring('livellm:'.length).trim();
    if (!type || !/^[\w][\w-]*$/.test(type)) {
        return null;
    }
    const jsonStr = content.trim();
    const parsed = safeParseJSON(jsonStr);
    if (!parsed.valid) {
        return null;
    }
    return {
        type,
        json: jsonStr,
        props: parsed.data,
    };
}
/**
 * Parses an inline livellm component from code text.
 * Format: livellm:componentType{"prop": "value"}
 */
function parseLiveLLMInline(text) {
    const match = text.match(/^livellm:([\w][\w-]*)(\{.*\})$/s);
    if (!match)
        return null;
    const type = match[1];
    const jsonStr = match[2];
    const parsed = safeParseJSON(jsonStr);
    if (!parsed.valid)
        return null;
    return {
        type,
        props: parsed.data,
    };
}

/**
 * @livellm/parser — Markdown parser with LiveLLM component support.
 * Extends markdown-it to detect livellm: code fences and inline code.
 */
class Parser {
    constructor(events, registry, config = {}) {
        this.events = events;
        this.registry = registry;
        this.md = new MarkdownIt({
            html: false, // We sanitize separately
            xhtmlOut: false,
            breaks: config.breaks ?? true,
            linkify: config.linkify ?? true,
            typographer: config.typographer ?? true,
        });
        // Enable GFM tables if configured
        if (config.gfm !== false) ;
        // Install the LiveLLM plugin
        this.md.use(this.livellmPlugin.bind(this));
    }
    /**
     * Parse markdown string to HTML with LiveLLM components.
     */
    parse(markdown) {
        this.events.emit('parser:start');
        const result = this.md.render(markdown);
        this.events.emit('parser:complete', result);
        return result;
    }
    /**
     * Get the markdown-it instance for advanced configuration.
     */
    getMarkdownIt() {
        return this.md;
    }
    /**
     * markdown-it plugin that handles livellm: code fences and inline code.
     */
    livellmPlugin(md) {
        // Override fence renderer for livellm: blocks
        const defaultFence = md.renderer.rules.fence;
        md.renderer.rules.fence = (tokens, idx, options, env, self) => {
            const token = tokens[idx];
            const info = token.info.trim();
            if (info.startsWith('livellm:')) {
                return this.renderLiveLLMBlock(info, token.content);
            }
            // Default fence rendering
            if (defaultFence) {
                return defaultFence(tokens, idx, options, env, self);
            }
            return self.renderToken(tokens, idx, options);
        };
        // Override code_inline renderer for livellm: inline components
        const defaultCodeInline = md.renderer.rules.code_inline;
        md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
            const token = tokens[idx];
            const content = token.content;
            if (content.startsWith('livellm:')) {
                return this.renderLiveLLMInline(content);
            }
            // Default code inline rendering
            if (defaultCodeInline) {
                return defaultCodeInline(tokens, idx, options, env, self);
            }
            return `<code>${md.utils.escapeHtml(content)}</code>`;
        };
    }
    /**
     * Render a livellm: code fence block as a Web Component placeholder.
     */
    renderLiveLLMBlock(info, content) {
        const parsed = parseLiveLLMBlock(info, content);
        if (!parsed) {
            this.events.emit('parser:error', new Error(`Failed to parse livellm block: ${info}`));
            return this.renderFallback(info, content, 'Invalid livellm block format');
        }
        const { type, json, props } = parsed;
        this.events.emit('parser:component:found', type, json);
        // Check if component is registered
        if (!this.registry.has(type)) {
            this.events.emit('component:unknown', type);
            return this.renderFallback(`livellm:${type}`, content, null);
        }
        // Validate props
        const validation = this.registry.validate(type, props);
        if (!validation.valid) {
            this.events.emit('registry:validation:failed', type, validation.errors);
            return this.renderError(type, content, validation.errors);
        }
        // Apply defaults
        const finalProps = this.registry.applyDefaults(type, props);
        const registration = this.registry.get(type);
        // Return the Web Component HTML
        const escapedProps = this.escapeAttr(JSON.stringify(finalProps));
        return (`<${registration.tagName} ` +
            `data-livellm="${type}" ` +
            `data-props="${escapedProps}">` +
            `</${registration.tagName}>\n`);
    }
    /**
     * Render a livellm: inline code as an inline Web Component.
     */
    renderLiveLLMInline(content) {
        const parsed = parseLiveLLMInline(content);
        if (!parsed) {
            return `<code>${this.escapeHtml(content)}</code>`;
        }
        const { type, props } = parsed;
        if (!this.registry.has(type)) {
            this.events.emit('component:unknown', type);
            return `<code>${this.escapeHtml(content)}</code>`;
        }
        const validation = this.registry.validate(type, props);
        if (!validation.valid) {
            this.events.emit('registry:validation:failed', type, validation.errors);
            return `<code>${this.escapeHtml(content)}</code>`;
        }
        const finalProps = this.registry.applyDefaults(type, props);
        const registration = this.registry.get(type);
        const escapedProps = this.escapeAttr(JSON.stringify(finalProps));
        return (`<${registration.tagName} ` +
            `data-livellm="${type}" ` +
            `data-props="${escapedProps}">` +
            `</${registration.tagName}>`);
    }
    /**
     * Render a fallback code block when the component is unknown or format is invalid.
     */
    renderFallback(info, content, error) {
        const escapedInfo = this.escapeHtml(info);
        const escapedContent = this.escapeHtml(content.trim());
        let html = `<div class="livellm-fallback">`;
        if (error) {
            html += `<div class="livellm-fallback-error">${this.escapeHtml(error)}</div>`;
        }
        html += `<pre><code class="language-${escapedInfo}">${escapedContent}</code></pre>`;
        html += `</div>\n`;
        return html;
    }
    /**
     * Render an error display when props are invalid.
     */
    renderError(type, content, errors) {
        const errorList = errors.map((e) => `<li>${this.escapeHtml(e.message)}</li>`).join('');
        return (`<div class="livellm-error">` +
            `<div class="livellm-error-header">Component "${this.escapeHtml(type)}" — validation errors:</div>` +
            `<ul class="livellm-error-list">${errorList}</ul>` +
            `<pre><code>${this.escapeHtml(content.trim())}</code></pre>` +
            `</div>\n`);
    }
    escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    escapeAttr(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}

/**
 * DOM utility functions for LiveLLM renderer.
 */
/**
 * Resolve a container from a string selector or HTMLElement.
 */
function resolveContainer(target) {
    if (typeof target === 'string') {
        return document.querySelector(target);
    }
    return target;
}
/**
 * Scroll an element's parent to make it visible.
 */
function scrollToBottom(container) {
    requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
    });
}

/**
 * HTML sanitization for LiveLLM.
 * Lightweight sanitizer that removes dangerous elements and attributes.
 * For production, consider integrating DOMPurify.
 */
const DANGEROUS_TAGS = new Set([
    'script', 'iframe', 'object', 'embed', 'form', 'input',
    'textarea', 'select', 'button', 'link', 'meta', 'style',
    'base', 'applet',
]);
const DANGEROUS_ATTRS = new Set([
    'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus',
    'onblur', 'onsubmit', 'onreset', 'onchange', 'oninput',
    'onkeydown', 'onkeyup', 'onkeypress', 'onmousedown',
    'onmouseup', 'onmousemove', 'onmouseout', 'oncontextmenu',
    'ondblclick', 'ondrag', 'ondrop', 'onscroll',
]);
/**
 * Sanitize an HTML string by removing dangerous tags and attributes.
 */
function sanitizeHTML(html) {
    // Create a temporary document to parse the HTML
    if (typeof DOMParser === 'undefined') {
        // Server-side: basic regex sanitization
        return stripDangerousTagsRegex(html);
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    sanitizeNode(doc.body);
    return doc.body.innerHTML;
}
function sanitizeNode(node) {
    const toRemove = [];
    for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        if (child.nodeType === Node.ELEMENT_NODE) {
            const el = child;
            const tagName = el.tagName.toLowerCase();
            if (DANGEROUS_TAGS.has(tagName)) {
                toRemove.push(child);
                continue;
            }
            // Remove dangerous attributes
            const attrs = Array.from(el.attributes);
            for (const attr of attrs) {
                const name = attr.name.toLowerCase();
                if (DANGEROUS_ATTRS.has(name) ||
                    name.startsWith('on') ||
                    attr.value.trim().toLowerCase().startsWith('javascript:')) {
                    el.removeAttribute(attr.name);
                }
            }
            // Recursively sanitize children
            sanitizeNode(child);
        }
    }
    for (const node of toRemove) {
        node.parentNode?.removeChild(node);
    }
}
function stripDangerousTagsRegex(html) {
    let sanitized = html;
    for (const tag of DANGEROUS_TAGS) {
        const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
        sanitized = sanitized.replace(regex, '');
        const selfClosing = new RegExp(`<${tag}[^>]*\\/?>`, 'gi');
        sanitized = sanitized.replace(selfClosing, '');
    }
    // Remove on* attributes
    sanitized = sanitized.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '');
    sanitized = sanitized.replace(/\s+on\w+\s*=\s*'[^']*'/gi, '');
    return sanitized;
}

/**
 * @livellm/renderer — DOM renderer.
 * Takes parsed HTML from the Parser and inserts it into the DOM.
 * Handles Web Component instantiation and action binding.
 */
class Renderer {
    constructor(events, registry, parser, config = {}) {
        this.events = events;
        this.registry = registry;
        this.parser = parser;
        this.config = {
            shadowDom: config.shadowDom ?? true,
            sanitize: config.sanitize ?? true,
            proseStyles: config.proseStyles ?? true,
        };
    }
    /**
     * Render markdown into a container element.
     */
    render(markdown, target) {
        const container = resolveContainer(target);
        if (!container) {
            console.error('[LiveLLM Renderer] Container not found:', target);
            return null;
        }
        this.events.emit('renderer:start');
        // Parse markdown to HTML (with LiveLLM components)
        let html = this.parser.parse(markdown);
        // Sanitize if enabled
        if (this.config.sanitize) {
            html = sanitizeHTML(html);
        }
        // Wrap in prose container for typography styles
        if (this.config.proseStyles) {
            html = `<div class="livellm-prose">${html}</div>`;
        }
        // Set HTML content
        container.innerHTML = html;
        // Bind action listeners to LiveLLM components in the container
        this.bindActions(container);
        this.events.emit('renderer:complete');
        return container;
    }
    /**
     * Render markdown to an HTML string (for SSR or pre-rendering).
     */
    renderToString(markdown) {
        let html = this.parser.parse(markdown);
        if (this.config.sanitize) {
            html = sanitizeHTML(html);
        }
        if (this.config.proseStyles) {
            html = `<div class="livellm-prose">${html}</div>`;
        }
        return html;
    }
    /**
     * Bind livellm:action event listeners to all LiveLLM components in a container.
     */
    bindActions(container) {
        container.addEventListener('livellm:action', ((event) => {
            const detail = event.detail;
            if (!detail)
                return;
            const action = {
                type: 'livellm:action',
                component: detail.component,
                action: detail.action,
                value: detail.data?.value ?? detail.data,
                label: detail.data?.label ?? '',
                metadata: {
                    componentId: detail.componentId || '',
                    timestamp: detail.timestamp || Date.now(),
                    questionContext: detail.data?.questionContext,
                },
            };
            this.events.emit('action:triggered', action);
        }));
    }
    /**
     * Clear a container's content.
     */
    clear(target) {
        const container = resolveContainer(target);
        if (container) {
            container.innerHTML = '';
        }
    }
}

/**
 * Table Detector — Detects markdown tables and transforms them into
 * livellm:table-plus components with sorting, search, and pagination.
 */
const TABLE_ROW_RE = /^\|(.+)\|$/;
const SEPARATOR_RE = /^\|[\s:]*-{2,}[\s:]*(\|[\s:]*-{2,}[\s:]*)*\|$/;
function parseMarkdownTable(text) {
    const lines = text.trim().split('\n').map((l) => l.trim());
    if (lines.length < 3)
        return null;
    // Line 0: header row
    if (!TABLE_ROW_RE.test(lines[0]))
        return null;
    // Line 1: separator row
    if (!SEPARATOR_RE.test(lines[1]))
        return null;
    const headers = lines[0]
        .slice(1, -1)
        .split('|')
        .map((h) => h.trim());
    // Parse alignments from separator
    const sepCells = lines[1]
        .slice(1, -1)
        .split('|')
        .map((s) => s.trim());
    const alignments = sepCells.map((s) => {
        const leftColon = s.startsWith(':');
        const rightColon = s.endsWith(':');
        if (leftColon && rightColon)
            return 'center';
        if (rightColon)
            return 'right';
        return 'left';
    });
    // Parse data rows
    const rows = [];
    for (let i = 2; i < lines.length; i++) {
        if (!TABLE_ROW_RE.test(lines[i]))
            break;
        const cells = lines[i]
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());
        rows.push(cells);
    }
    if (rows.length === 0)
        return null;
    return { headers, rows, alignments };
}
const tableDetector = {
    detect(markdown) {
        const matches = [];
        const lines = markdown.split('\n');
        let i = 0;
        while (i < lines.length) {
            const trimmed = lines[i].trim();
            // Look for a header row (starts and ends with |)
            if (TABLE_ROW_RE.test(trimmed) && i + 1 < lines.length) {
                const nextTrimmed = lines[i + 1].trim();
                if (SEPARATOR_RE.test(nextTrimmed)) {
                    // Found a table — gather all contiguous rows
                    const tableStart = i;
                    let tableEnd = i + 2;
                    while (tableEnd < lines.length && TABLE_ROW_RE.test(lines[tableEnd].trim())) {
                        tableEnd++;
                    }
                    const tableText = lines.slice(tableStart, tableEnd).join('\n');
                    const parsed = parseMarkdownTable(tableText);
                    if (parsed && parsed.rows.length >= 2) {
                        // Calculate character offsets
                        let startOffset = 0;
                        for (let j = 0; j < tableStart; j++) {
                            startOffset += lines[j].length + 1;
                        }
                        let endOffset = startOffset;
                        for (let j = tableStart; j < tableEnd; j++) {
                            endOffset += lines[j].length + (j < tableEnd - 1 ? 1 : 0);
                        }
                        // Include trailing newline if present
                        if (tableEnd < lines.length) {
                            endOffset += 1;
                        }
                        const numericColumns = detectNumericColumns(parsed);
                        matches.push({
                            start: startOffset,
                            end: endOffset,
                            data: {
                                headers: parsed.headers,
                                rows: parsed.rows,
                                alignments: parsed.alignments,
                                numericColumns,
                            },
                            confidence: calculateTableConfidence(parsed),
                            apply: () => { },
                        });
                        i = tableEnd;
                        continue;
                    }
                }
            }
            i++;
        }
        return matches;
    },
    transform(match) {
        const { headers, rows } = match.data;
        const columns = headers.map((h, idx) => ({
            key: `col${idx}`,
            label: h,
            sortable: true,
        }));
        const dataRows = rows.map((row) => {
            const obj = {};
            headers.forEach((h, idx) => {
                obj[`col${idx}`] = row[idx] || '';
            });
            return obj;
        });
        const props = {
            columns,
            data: dataRows,
            searchable: rows.length >= 5,
            paginate: rows.length > 10,
            pageSize: rows.length > 10 ? 10 : rows.length,
        };
        return '```livellm:table-plus\n' + JSON.stringify(props) + '\n```';
    },
};
function detectNumericColumns(table) {
    const numeric = [];
    for (let col = 0; col < table.headers.length; col++) {
        const isNumeric = table.rows.every((row) => {
            const val = (row[col] || '').replace(/[$,%]/g, '').trim();
            return val === '' || !isNaN(Number(val));
        });
        if (isNumeric)
            numeric.push(col);
    }
    return numeric;
}
function calculateTableConfidence(table) {
    let confidence = 0.7; // Base confidence for valid table
    // More rows = higher confidence
    if (table.rows.length >= 5)
        confidence += 0.1;
    if (table.rows.length >= 10)
        confidence += 0.05;
    // Consistent column count
    const headerCount = table.headers.length;
    const allConsistent = table.rows.every((r) => r.length === headerCount);
    if (allConsistent)
        confidence += 0.1;
    return Math.min(confidence, 1.0);
}

/**
 * Question Detector — Detects questions with numbered/lettered options
 * and transforms them into livellm:choice or livellm:confirm components.
 */
// Matches a line containing a question mark
const QUESTION_RE = /^(.+\?.*?)$/m;
// Matches numbered options: "1. Option", "1) Option", "a. Option", "a) Option"
const NUMBERED_OPTION_RE = /^[\t ]*(?:(\d+|[a-zA-Z])[.)]\s+)(.+)$/;
// Matches yes/no style questions
const YES_NO_RE = /\b(yes\s*(?:\/|or)\s*no|confirm|agree|proceed|continue|accept|approve)\b/i;
function findQuestionBlocks(markdown) {
    const results = [];
    const lines = markdown.split('\n');
    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();
        // Check if this line is a question
        const qMatch = line.match(QUESTION_RE);
        if (qMatch) {
            const question = qMatch[1];
            // Check if next lines contain options
            const options = [];
            let j = i + 1;
            // Skip blank lines between question and options
            while (j < lines.length && lines[j].trim() === '') {
                j++;
            }
            // Gather option lines
            while (j < lines.length) {
                const optMatch = lines[j].match(NUMBERED_OPTION_RE);
                if (optMatch) {
                    options.push(optMatch[2].trim());
                    j++;
                }
                else {
                    break;
                }
            }
            if (options.length >= 2) {
                // Calculate offsets
                let startOffset = 0;
                for (let k = 0; k < i; k++) {
                    startOffset += lines[k].length + 1;
                }
                let endOffset = startOffset;
                for (let k = i; k < j; k++) {
                    endOffset += lines[k].length + (k < j - 1 ? 1 : 0);
                }
                if (j < lines.length)
                    endOffset += 1;
                results.push({
                    block: {
                        question,
                        options,
                        isYesNo: false,
                    },
                    start: startOffset,
                    end: endOffset,
                });
                i = j;
                continue;
            }
            // Check for yes/no pattern in the question itself
            if (YES_NO_RE.test(question) && options.length === 0) {
                let startOffset = 0;
                for (let k = 0; k < i; k++) {
                    startOffset += lines[k].length + 1;
                }
                const endOffset = startOffset + lines[i].length + (i + 1 < lines.length ? 1 : 0);
                results.push({
                    block: {
                        question,
                        options: ['Yes', 'No'],
                        isYesNo: true,
                    },
                    start: startOffset,
                    end: endOffset,
                });
            }
        }
        i++;
    }
    return results;
}
const questionDetector = {
    detect(markdown) {
        const blocks = findQuestionBlocks(markdown);
        return blocks.map(({ block, start, end }) => ({
            start,
            end,
            data: {
                question: block.question,
                options: block.options,
                isYesNo: block.isYesNo,
            },
            confidence: calculateQuestionConfidence(block),
            apply: () => { },
        }));
    },
    transform(match) {
        const { question, options, isYesNo } = match.data;
        if (isYesNo || options.length === 2) {
            // Use confirm component for binary choices
            const props = {
                text: question,
                confirmLabel: options[0],
                cancelLabel: options[1],
            };
            return '```livellm:confirm\n' + JSON.stringify(props) + '\n```';
        }
        // Use choice component for multiple options
        const props = {
            question,
            options: options.map((opt, idx) => ({
                label: opt,
                value: `option_${idx}`,
            })),
        };
        return '```livellm:choice\n' + JSON.stringify(props) + '\n```';
    },
};
function calculateQuestionConfidence(block) {
    let confidence = 0.7;
    // Yes/no questions are very clear intent
    if (block.isYesNo)
        confidence += 0.15;
    // More options = clearer pattern
    if (block.options.length >= 3)
        confidence += 0.1;
    if (block.options.length >= 5)
        confidence += 0.05;
    // Short, clear options
    const avgOptionLen = block.options.reduce((sum, o) => sum + o.length, 0) / block.options.length;
    if (avgOptionLen < 50)
        confidence += 0.05;
    return Math.min(confidence, 1.0);
}

/**
 * Address Detector — Detects physical addresses and transforms them
 * into livellm:map components using OpenStreetMap.
 */
// Common address patterns
// "123 Main St, City, State ZIP"
// "123 Main Street, Apt 4B, City, ST 12345"
// Street address with city, state, zip
const US_ADDRESS_RE = /\d{1,5}\s+[\w\s.]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl|Circle|Cir|Trail|Trl|Parkway|Pkwy|Highway|Hwy)\.?(?:\s*,?\s*(?:Apt|Suite|Ste|Unit|#)\s*[\w-]+)?\s*,\s*[\w\s]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?/gi;
// Location with coordinates: "lat: 40.7128, lng: -74.0060" or "(40.7128, -74.0060)"
const COORDS_RE = /(?:(?:lat(?:itude)?|location)\s*[:=]\s*)?(-?\d{1,3}\.\d{3,})\s*,\s*(?:(?:lng|lon(?:gitude)?)\s*[:=]\s*)?(-?\d{1,3}\.\d{3,})/gi;
function findAddresses(markdown) {
    const matches = [];
    const seen = new Set(); // Avoid duplicate overlapping matches
    // Look for US-style addresses
    let m;
    US_ADDRESS_RE.lastIndex = 0;
    while ((m = US_ADDRESS_RE.exec(markdown)) !== null) {
        const key = `${m.index}:${m.index + m[0].length}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        matches.push({
            start: m.index,
            end: m.index + m[0].length,
            data: {
                address: m[0].trim(),
                type: 'address',
            },
            confidence: 0.85,
            apply: () => { },
        });
    }
    // Look for coordinate pairs
    COORDS_RE.lastIndex = 0;
    while ((m = COORDS_RE.exec(markdown)) !== null) {
        const lat = parseFloat(m[1]);
        const lng = parseFloat(m[2]);
        // Validate coordinate ranges
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
            continue;
        const key = `${m.index}:${m.index + m[0].length}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        matches.push({
            start: m.index,
            end: m.index + m[0].length,
            data: {
                lat,
                lng,
                type: 'coordinates',
            },
            confidence: 0.9,
            apply: () => { },
        });
    }
    return matches;
}
const addressDetector = {
    detect(markdown) {
        return findAddresses(markdown);
    },
    transform(match) {
        if (match.data.type === 'coordinates') {
            const props = {
                lat: match.data.lat,
                lng: match.data.lng,
                zoom: 15,
                title: `Location (${match.data.lat}, ${match.data.lng})`,
            };
            return '```livellm:map\n' + JSON.stringify(props) + '\n```';
        }
        // For text addresses, we encode the address for OSM search
        const props = {
            address: match.data.address,
            zoom: 16,
            title: match.data.address,
        };
        return '```livellm:map\n' + JSON.stringify(props) + '\n```';
    },
};

/**
 * Code Detector — Detects standard code fences (```lang) and transforms
 * them into livellm:code-runner components with syntax highlighting and
 * optional execution capability.
 *
 * Only detects non-livellm code blocks (regular markdown code fences).
 */
// Matches a full fenced code block: ```lang\ncode\n```
const CODE_FENCE_RE = /^```(\w+)\n([\s\S]*?)^```$/gm;
// Languages that are typically runnable
const RUNNABLE_LANGUAGES = new Set([
    'javascript', 'js',
    'typescript', 'ts',
    'python', 'py',
    'html',
    'css',
    'sql',
    'shell', 'bash', 'sh',
]);
// Languages with well-known syntax highlighting
const KNOWN_LANGUAGES = new Set([
    'javascript', 'js', 'typescript', 'ts', 'python', 'py',
    'java', 'c', 'cpp', 'csharp', 'cs', 'go', 'rust', 'ruby', 'rb',
    'php', 'swift', 'kotlin', 'scala', 'html', 'css', 'scss', 'less',
    'json', 'yaml', 'yml', 'xml', 'toml', 'ini', 'markdown', 'md',
    'sql', 'graphql', 'shell', 'bash', 'sh', 'powershell', 'ps1',
    'dockerfile', 'makefile', 'lua', 'r', 'perl', 'elixir', 'erlang',
    'haskell', 'clojure', 'dart', 'objective-c', 'objc',
]);
const codeDetector = {
    detect(markdown) {
        const matches = [];
        CODE_FENCE_RE.lastIndex = 0;
        let m;
        while ((m = CODE_FENCE_RE.exec(markdown)) !== null) {
            const lang = m[1].toLowerCase();
            const code = m[2];
            // Skip livellm blocks
            if (lang.startsWith('livellm:'))
                continue;
            // Skip very short code (likely inline examples)
            if (code.trim().split('\n').length < 2 && code.trim().length < 20)
                continue;
            const isRunnable = RUNNABLE_LANGUAGES.has(lang);
            const isKnown = KNOWN_LANGUAGES.has(lang);
            matches.push({
                start: m.index,
                end: m.index + m[0].length,
                data: {
                    language: lang,
                    code: code.trimEnd(),
                    runnable: isRunnable,
                },
                confidence: calculateCodeConfidence(lang, code, isKnown),
                apply: () => { },
            });
        }
        return matches;
    },
    transform(match) {
        const { language, code, runnable } = match.data;
        const props = {
            language,
            code,
            showLineNumbers: code.split('\n').length > 5,
            copyable: true,
        };
        if (runnable) {
            props.runnable = true;
        }
        return '```livellm:code-runner\n' + JSON.stringify(props) + '\n```';
    },
};
function calculateCodeConfidence(lang, code, isKnown) {
    let confidence = 0.6;
    // Known language boosts confidence
    if (isKnown)
        confidence += 0.15;
    // Longer code blocks benefit more from enhanced rendering
    const lineCount = code.split('\n').length;
    if (lineCount >= 5)
        confidence += 0.1;
    if (lineCount >= 15)
        confidence += 0.05;
    // Runnable code has more to gain from code-runner
    if (RUNNABLE_LANGUAGES.has(lang))
        confidence += 0.05;
    return Math.min(confidence, 1.0);
}

/**
 * Link Detector — Detects standalone URLs (not in markdown links) and
 * transforms them into livellm:link-preview components.
 */
// Matches standalone URLs on their own line (not inside markdown links or images)
// Negative lookbehind for ]( and ![ to avoid matching markdown links/images
const STANDALONE_URL_RE = /^(?:https?:\/\/)[^\s<>"{}|\\^`[\]]+$/gm;
// URLs already in markdown link format: [text](url) or ![alt](url)
const MD_LINK_RE = /!?\[([^\]]*)\]\(([^)]+)\)/g;
// Known content sites that benefit from preview
const PREVIEW_DOMAINS = new Set([
    'github.com', 'stackoverflow.com', 'youtube.com', 'youtu.be',
    'twitter.com', 'x.com', 'medium.com', 'dev.to', 'reddit.com',
    'wikipedia.org', 'npmjs.com', 'pypi.org', 'docs.google.com',
    'arxiv.org', 'news.ycombinator.com',
]);
function getDomain(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    }
    catch {
        return '';
    }
}
function isUrlInMarkdownLink(markdown, urlStart, urlEnd) {
    // Check if this URL is part of a markdown link [text](url) or ![alt](url)
    MD_LINK_RE.lastIndex = 0;
    let m;
    while ((m = MD_LINK_RE.exec(markdown)) !== null) {
        const linkStart = m.index;
        const linkEnd = m.index + m[0].length;
        if (urlStart >= linkStart && urlEnd <= linkEnd) {
            return true;
        }
    }
    return false;
}
const linkDetector = {
    detect(markdown) {
        const matches = [];
        STANDALONE_URL_RE.lastIndex = 0;
        let m;
        while ((m = STANDALONE_URL_RE.exec(markdown)) !== null) {
            const url = m[0].trim();
            const start = m.index;
            const end = m.index + m[0].length;
            // Skip if already inside a markdown link
            if (isUrlInMarkdownLink(markdown, start, end))
                continue;
            const domain = getDomain(url);
            if (!domain)
                continue;
            const isPreviewDomain = PREVIEW_DOMAINS.has(domain);
            matches.push({
                start,
                end,
                data: {
                    url,
                    domain,
                    isPreviewDomain,
                },
                confidence: isPreviewDomain ? 0.85 : 0.7,
                apply: () => { },
            });
        }
        return matches;
    },
    transform(match) {
        const { url, domain } = match.data;
        const props = {
            url,
            domain,
        };
        return '```livellm:link-preview\n' + JSON.stringify(props) + '\n```';
    },
};

/**
 * List Detector — Detects ordered lists that represent sequential steps
 * and transforms them into livellm:accordion components.
 *
 * Heuristics for step detection:
 * - Ordered list (1. 2. 3.)
 * - Each item has substantial content (not just a word)
 * - Items represent a sequential process (keywords: first, then, next, finally, etc.)
 */
const ORDERED_ITEM_RE = /^[\t ]*(\d+)[.)]\s+(.+)$/;
const STEP_KEYWORDS = /\b(step|first|then|next|after|finally|lastly|begin|start|install|configure|create|setup|set up|open|click|navigate|run|execute|add|import|define|build|deploy|test|verify|check)\b/i;
function findOrderedLists(markdown) {
    const results = [];
    const lines = markdown.split('\n');
    let i = 0;
    while (i < lines.length) {
        const match = lines[i].match(ORDERED_ITEM_RE);
        if (match) {
            const listStart = i;
            const items = [];
            let j = i;
            // Gather all consecutive ordered list items (allowing continuation lines)
            while (j < lines.length) {
                const itemMatch = lines[j].match(ORDERED_ITEM_RE);
                if (itemMatch) {
                    let text = itemMatch[2];
                    // Check for continuation lines (indented, not a new list item)
                    let k = j + 1;
                    while (k < lines.length) {
                        const nextLine = lines[k];
                        const isContinuation = nextLine.match(/^[\t ]{2,}\S/) && !nextLine.match(ORDERED_ITEM_RE);
                        if (isContinuation) {
                            text += ' ' + nextLine.trim();
                            k++;
                        }
                        else if (nextLine.trim() === '') {
                            // Allow one blank line within continuation
                            if (k + 1 < lines.length && lines[k + 1].match(/^[\t ]{2,}\S/)) {
                                k++;
                            }
                            else {
                                break;
                            }
                        }
                        else {
                            break;
                        }
                    }
                    items.push({ number: parseInt(itemMatch[1], 10), text: text.trim() });
                    j = k;
                }
                else if (lines[j].trim() === '') {
                    // Allow blank lines between items
                    j++;
                }
                else {
                    break;
                }
            }
            if (items.length >= 3) {
                // Calculate offsets
                let startOffset = 0;
                for (let k = 0; k < listStart; k++) {
                    startOffset += lines[k].length + 1;
                }
                let endOffset = startOffset;
                for (let k = listStart; k < j; k++) {
                    endOffset += lines[k].length + (k < j - 1 ? 1 : 0);
                }
                if (j < lines.length)
                    endOffset += 1;
                // Check for step-like content
                const stepCount = items.filter((item) => STEP_KEYWORDS.test(item.text)).length;
                const hasStepPattern = stepCount >= items.length * 0.4;
                // Check that items are sequential
                const isSequential = items.every((item, idx) => idx === 0 || item.number > items[idx - 1].number);
                // Only include if items have meaningful content
                const avgLength = items.reduce((sum, it) => sum + it.text.length, 0) / items.length;
                if (avgLength >= 15 && isSequential) {
                    results.push({
                        block: { items, hasStepPattern },
                        start: startOffset,
                        end: endOffset,
                    });
                }
            }
            i = j;
            continue;
        }
        i++;
    }
    return results;
}
const listDetector = {
    detect(markdown) {
        const lists = findOrderedLists(markdown);
        return lists.map(({ block, start, end }) => ({
            start,
            end,
            data: {
                items: block.items,
                hasStepPattern: block.hasStepPattern,
            },
            confidence: calculateListConfidence(block),
            apply: () => { },
        }));
    },
    transform(match) {
        const { items } = match.data;
        const sections = items.map((item) => ({
            title: `Step ${item.number}`,
            content: item.text,
        }));
        const props = {
            sections,
            mode: 'exclusive',
            defaultOpen: 0,
        };
        return '```livellm:accordion\n' + JSON.stringify(props) + '\n```';
    },
};
function calculateListConfidence(block) {
    let confidence = 0.65;
    // Step-like keywords boost confidence
    if (block.hasStepPattern)
        confidence += 0.15;
    // More items = clearer step sequence
    if (block.items.length >= 5)
        confidence += 0.1;
    if (block.items.length >= 8)
        confidence += 0.05;
    // Long detailed items benefit more from accordion
    const avgLen = block.items.reduce((s, i) => s + i.text.length, 0) / block.items.length;
    if (avgLen >= 50)
        confidence += 0.05;
    return Math.min(confidence, 1.0);
}

/**
 * Data Detector — Detects patterns of numeric data (key-value pairs,
 * statistics, metrics) and transforms them into livellm:chart components.
 *
 * Patterns detected:
 * - "Label: 123" or "Label: 45%" style key-value lists
 * - Bullet lists with numeric values
 * - Comparison patterns: "A vs B: 100 vs 200"
 */
// Matches "Label: 123", "Label: 45%", "Label: $1,234"
const KEY_VALUE_RE = /^[\t ]*[-*]?\s*\**(.+?)\**\s*[:–—]\s*[$]?([\d,]+\.?\d*)\s*(%|[KMBkmb])?/;
// Matches "- Label: 123" style bullet points with values
const BULLET_VALUE_RE = /^[\t ]*[-*]\s+(.+?):\s*[$]?([\d,]+\.?\d*)\s*(%|[KMBkmb])?$/;
function parseNumericValue(raw) {
    return parseFloat(raw.replace(/,/g, ''));
}
function findDataBlocks(markdown) {
    const results = [];
    const lines = markdown.split('\n');
    let i = 0;
    while (i < lines.length) {
        const points = [];
        const blockStart = i;
        let hasPercentages = false;
        // Try to match consecutive key-value lines
        while (i < lines.length) {
            const line = lines[i].trim();
            if (line === '') {
                // Allow one blank line within a block
                if (i + 1 < lines.length && (KEY_VALUE_RE.test(lines[i + 1].trim()) || BULLET_VALUE_RE.test(lines[i + 1].trim()))) {
                    i++;
                    continue;
                }
                break;
            }
            let match = line.match(KEY_VALUE_RE) || line.match(BULLET_VALUE_RE);
            if (match) {
                const label = match[1].trim();
                const value = parseNumericValue(match[2]);
                const suffix = match[3] || '';
                if (!isNaN(value)) {
                    points.push({ label, value, suffix });
                    if (suffix === '%')
                        hasPercentages = true;
                }
                i++;
            }
            else {
                break;
            }
        }
        if (points.length >= 3) {
            // Calculate offsets
            let startOffset = 0;
            for (let k = 0; k < blockStart; k++) {
                startOffset += lines[k].length + 1;
            }
            let endOffset = startOffset;
            for (let k = blockStart; k < i; k++) {
                endOffset += lines[k].length + (k < i - 1 ? 1 : 0);
            }
            if (i < lines.length)
                endOffset += 1;
            // Check if labels look like time series (years, months, dates)
            const timeLabels = points.filter((p) => /^\d{4}$/.test(p.label) ||
                /^(Q[1-4]|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(p.label) ||
                /^\d{1,2}\/\d{1,2}/.test(p.label));
            const isTimeSeries = timeLabels.length >= points.length * 0.6;
            results.push({
                block: { points, hasPercentages, isTimeSeries },
                start: startOffset,
                end: endOffset,
            });
        }
        if (points.length < 3)
            i++;
    }
    return results;
}
const dataDetector = {
    detect(markdown) {
        const blocks = findDataBlocks(markdown);
        return blocks.map(({ block, start, end }) => ({
            start,
            end,
            data: {
                points: block.points,
                hasPercentages: block.hasPercentages,
                isTimeSeries: block.isTimeSeries,
            },
            confidence: calculateDataConfidence(block),
            apply: () => { },
        }));
    },
    transform(match) {
        const { points, hasPercentages, isTimeSeries } = match.data;
        // Choose chart type based on data characteristics
        let chartType = 'bar';
        if (isTimeSeries) {
            chartType = 'line';
        }
        else if (hasPercentages && points.length <= 8) {
            chartType = 'pie';
        }
        const labels = points.map((p) => p.label);
        const values = points.map((p) => p.value);
        const props = {
            type: chartType,
            labels,
            datasets: [
                {
                    label: 'Values',
                    data: values,
                },
            ],
        };
        if (hasPercentages) {
            props.suffix = '%';
        }
        return '```livellm:chart\n' + JSON.stringify(props) + '\n```';
    },
};
function calculateDataConfidence(block) {
    let confidence = 0.65;
    // More data points = higher confidence
    if (block.points.length >= 5)
        confidence += 0.1;
    if (block.points.length >= 8)
        confidence += 0.05;
    // Percentages are a clear signal for chart visualization
    if (block.hasPercentages)
        confidence += 0.1;
    // Time series is very chart-friendly
    if (block.isTimeSeries)
        confidence += 0.1;
    // Consistent suffix across all points
    const suffixes = new Set(block.points.map((p) => p.suffix));
    if (suffixes.size === 1)
        confidence += 0.05;
    return Math.min(confidence, 1.0);
}

/**
 * All built-in detectors as a name→definition map.
 */
const builtInDetectors = {
    table: tableDetector,
    question: questionDetector,
    address: addressDetector,
    code: codeDetector,
    link: linkDetector,
    list: listDetector,
    data: dataDetector,
};

/**
 * @livellm/transformer — Analyzes raw LLM responses and enriches them
 * with livellm: blocks where interactive components would add value.
 */
class Transformer {
    constructor(events, config = {}) {
        this.detectors = new Map();
        this.disabledDetectors = new Set();
        this.events = events;
        this.config = {
            mode: config.mode ?? 'auto',
            detectors: config.detectors ?? 'all',
            confidenceThreshold: config.confidenceThreshold ?? 0.7,
        };
    }
    /**
     * Register a detector.
     */
    register(name, detector) {
        this.detectors.set(name, detector);
    }
    /**
     * Register all built-in detectors (table, question, address, code, link, list, data).
     */
    registerBuiltIns() {
        for (const [name, detector] of Object.entries(builtInDetectors)) {
            this.detectors.set(name, detector);
        }
    }
    /**
     * Disable a specific detector.
     */
    disable(name) {
        this.disabledDetectors.add(name);
    }
    /**
     * Enable a previously disabled detector.
     */
    enable(name) {
        this.disabledDetectors.delete(name);
    }
    /**
     * List active detector names.
     */
    listDetectors() {
        return Array.from(this.detectors.keys()).filter((name) => !this.disabledDetectors.has(name));
    }
    /**
     * Transform raw markdown by detecting patterns and enriching with livellm: blocks.
     */
    transform(markdown) {
        if (this.config.mode === 'off') {
            return markdown;
        }
        this.events.emit('transformer:start', markdown);
        const activeDetectors = this.getActiveDetectors();
        // Collect all matches with their original DetectionMatch data
        const allMatches = [];
        for (const [name, detector] of activeDetectors) {
            try {
                const matches = detector.detect(markdown);
                for (const match of matches) {
                    allMatches.push({ type: name, match });
                }
            }
            catch (err) {
                console.error(`[LiveLLM Transformer] Detector "${name}" failed:`, err);
            }
        }
        // Build Detection array for events
        const allDetections = allMatches.map(({ type, match }) => ({
            type,
            position: { start: match.start, end: match.end },
            confidence: match.confidence,
            apply: () => { },
        }));
        this.events.emit('transformer:detected', allDetections);
        if (this.config.mode === 'passive') {
            return markdown;
        }
        // Auto mode: apply transformations above confidence threshold
        // Filter by confidence, sort by position descending (to avoid offset issues)
        const applicable = allMatches
            .filter((d) => d.match.confidence >= this.config.confidenceThreshold)
            .sort((a, b) => b.match.start - a.match.start);
        // Remove overlapping detections (keep higher confidence)
        const nonOverlapping = this.resolveOverlaps(applicable);
        let result = markdown;
        for (const { type, match } of nonOverlapping) {
            const detector = this.detectors.get(type);
            if (!detector)
                continue;
            const transformed = detector.transform(match);
            result =
                result.substring(0, match.start) +
                    transformed +
                    result.substring(match.end);
        }
        this.events.emit('transformer:enriched', result);
        return result;
    }
    /**
     * Resolve overlapping detections — keep the one with higher confidence.
     * Input must be sorted by start position descending.
     */
    resolveOverlaps(sorted) {
        if (sorted.length <= 1)
            return sorted;
        const result = [];
        const used = new Set();
        // Sort by confidence desc first, then apply greedily
        const byConfidence = [...sorted].sort((a, b) => b.match.confidence - a.match.confidence);
        for (const item of byConfidence) {
            let overlaps = false;
            for (const idx of used) {
                const existing = byConfidence[idx];
                if (item.match.start < existing.match.end &&
                    item.match.end > existing.match.start) {
                    overlaps = true;
                    break;
                }
            }
            if (!overlaps) {
                used.add(byConfidence.indexOf(item));
                result.push(item);
            }
        }
        // Re-sort by position descending for safe substring replacement
        return result.sort((a, b) => b.match.start - a.match.start);
    }
    getActiveDetectors() {
        const active = new Map();
        const allowedDetectors = this.config.detectors;
        for (const [name, detector] of this.detectors) {
            if (this.disabledDetectors.has(name))
                continue;
            if (allowedDetectors !== 'all' && !allowedDetectors.includes(name))
                continue;
            active.set(name, detector);
        }
        return active;
    }
}

/**
 * @livellm/actions — Bidirectional action system.
 * Captures user interactions from components and routes them back to the chat platform.
 */
class Actions {
    constructor(events, config = {}) {
        this.events = events;
        this.config = {
            onAction: config.onAction || (() => { }),
            autoSend: config.autoSend ?? false,
            showPreview: config.showPreview ?? true,
            labelTemplates: config.labelTemplates || {},
        };
        // Listen for action events from the renderer
        this.events.on('action:triggered', this.handleAction.bind(this));
    }
    /**
     * Handle an incoming action from a component.
     */
    handleAction(action) {
        // Apply custom label template if available
        const template = this.config.labelTemplates[action.component];
        if (template && typeof template === 'function') {
            action.label = template(action.value, action.metadata);
        }
        if (this.config.autoSend) {
            // Send immediately without confirmation
            this.send(action);
        }
        else {
            // Emit preview event — let the host UI show confirmation
            this.events.emit('action:previewing', action);
        }
    }
    /**
     * Send an action (called directly or after user confirmation).
     */
    send(action) {
        this.events.emit('action:confirmed', action);
        try {
            this.config.onAction(action);
            this.events.emit('action:sent', action);
        }
        catch (err) {
            console.error('[LiveLLM Actions] Error in onAction callback:', err);
        }
    }
    /**
     * Cancel a pending action.
     */
    cancel(action) {
        this.events.emit('action:cancelled', action);
    }
    /**
     * Update the actions configuration.
     */
    updateConfig(config) {
        Object.assign(this.config, config);
    }
}

/**
 * @livellm/streaming — Token-by-token stream renderer.
 *
 * The stream renderer processes tokens incrementally:
 * 1. Text tokens are accumulated and rendered as markdown in batches
 * 2. When a ```livellm: fence is detected, a skeleton placeholder appears
 * 3. The JSON body is buffered until the closing ```
 * 4. The skeleton is replaced with the real Web Component
 */
class StreamRenderer {
    constructor(events, registry, parser, renderer, target, options = {}) {
        this.fullBuffer = ''; // Complete accumulated text
        this.textAccum = ''; // Current text segment being accumulated
        this.fenceAccum = ''; // Accumulator for partial fence detection
        this.componentType = ''; // Type of component being buffered
        this.componentJson = ''; // JSON body being buffered
        this.internalState = 'IDLE';
        this.textBlock = null;
        this.pendingElement = null;
        this.cursorElement = null;
        this.aborted = false;
        this.renderRAF = null;
        this.textDirty = false;
        this.events = events;
        this.registry = registry;
        this.parser = parser;
        this.renderer = renderer;
        const resolved = resolveContainer(target);
        if (!resolved) {
            throw new Error('[LiveLLM StreamRenderer] Container not found');
        }
        this.container = resolved;
        this.config = {
            tokenDelay: options.tokenDelay ?? 0,
            skeletonDelay: options.skeletonDelay ?? 200,
            transformOnComplete: options.transformOnComplete ?? true,
            transformDuringStream: options.transformDuringStream ?? false,
            autoScroll: options.autoScroll ?? true,
            showCursor: options.showCursor ?? true,
            cursorChar: options.cursorChar ?? '▊',
            onStart: options.onStart,
            onToken: options.onToken,
            onComponentStart: options.onComponentStart,
            onComponentComplete: options.onComponentComplete,
            onEnd: options.onEnd,
            onError: options.onError,
        };
        if (this.config.showCursor) {
            this.createCursor();
        }
    }
    // ═══ Public API ═══════════════════════════════════════════
    /**
     * Push a token (text chunk) into the stream.
     */
    push(token) {
        if (this.aborted)
            return;
        if (this.internalState === 'IDLE') {
            this.internalState = 'TEXT';
            this.events.emit('stream:connected', 'manual');
            this.config.onStart?.();
        }
        this.fullBuffer += token;
        this.config.onToken?.(token);
        this.events.emit('stream:token', token);
        // Process character by character for precise fence detection
        for (const ch of token) {
            this.processChar(ch);
        }
        // Schedule a render if text changed
        this.scheduleRender();
    }
    /**
     * Signal the end of the stream.
     */
    end() {
        if (this.aborted)
            return;
        // Flush any in-progress state
        if (this.internalState === 'FENCE_MAYBE') {
            // The fence never completed — treat as normal text
            this.textAccum += this.fenceAccum;
            this.fenceAccum = '';
        }
        else if (this.internalState === 'COMPONENT') {
            // Component never closed — render as fallback
            this.flushComponentAsFallback();
        }
        // Flush any residual backticks held in fenceAccum (TEXT/IDLE state).
        // processTextChar() holds 1-2 backticks waiting to see if they become ```.
        // Without this, the closing backtick of inline components like
        // `livellm:alert{...}` gets lost, preventing parser from forming code_inline tokens.
        if (this.fenceAccum) {
            this.textAccum += this.fenceAccum;
            this.fenceAccum = '';
        }
        // Final text render
        this.flushText();
        this.removeCursor();
        // Cancel any pending RAF
        if (this.renderRAF !== null) {
            cancelAnimationFrame(this.renderRAF);
            this.renderRAF = null;
        }
        // Bind actions to all rendered components
        this.renderer.bindActions(this.container);
        this.internalState = 'DONE';
        this.config.onEnd?.(this.fullBuffer);
        this.events.emit('stream:end', this.fullBuffer);
    }
    /**
     * Abort the stream.
     */
    abort() {
        this.aborted = true;
        this.removeCursor();
        if (this.renderRAF !== null) {
            cancelAnimationFrame(this.renderRAF);
            this.renderRAF = null;
        }
        this.internalState = 'DONE';
    }
    /**
     * Get the current stream state.
     */
    getState() {
        switch (this.internalState) {
            case 'IDLE': return 'IDLE';
            case 'TEXT': return 'RENDERING';
            case 'FENCE_MAYBE': return 'DETECTING';
            case 'COMPONENT': return 'BUFFERING';
            case 'DONE': return 'INTERACTIVE';
        }
    }
    /**
     * Get the full accumulated text.
     */
    getFullText() {
        return this.fullBuffer;
    }
    // ═══ Stream Adapters ═════════════════════════════════════
    /**
     * Connect to a ReadableStream (fetch API).
     */
    async connectStream(stream, extractToken) {
        this.events.emit('stream:connected', 'ReadableStream');
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done || this.aborted)
                    break;
                const chunk = decoder.decode(value, { stream: true });
                const token = extractToken ? extractToken(chunk) : chunk;
                if (token)
                    this.push(token);
            }
            if (!this.aborted)
                this.end();
        }
        catch (err) {
            this.config.onError?.(err);
            this.events.emit('stream:error', err);
        }
    }
    /**
     * Connect to Server-Sent Events.
     */
    connectSSE(source, options) {
        this.events.emit('stream:connected', 'SSE');
        const eventName = options.eventName || 'message';
        const handler = (event) => {
            if (this.aborted) {
                source.removeEventListener(eventName, handler);
                return;
            }
            const data = event.data;
            if (options.doneSignal && data === options.doneSignal) {
                source.close();
                this.end();
                return;
            }
            const token = options.extractToken(data);
            if (token)
                this.push(token);
        };
        source.addEventListener(eventName, handler);
        source.addEventListener('error', () => {
            if (!this.aborted)
                this.end();
        });
    }
    /**
     * Connect to a WebSocket.
     */
    connectWebSocket(ws, options) {
        this.events.emit('stream:connected', 'WebSocket');
        ws.addEventListener('message', (event) => {
            if (this.aborted)
                return;
            if (options.doneSignal && event.data === options.doneSignal) {
                this.end();
                return;
            }
            const token = options.extractToken(event);
            if (token)
                this.push(token);
        });
        ws.addEventListener('close', () => {
            if (!this.aborted && this.internalState !== 'DONE')
                this.end();
        });
        ws.addEventListener('error', () => {
            if (!this.aborted && this.internalState !== 'DONE')
                this.end();
        });
    }
    // ═══ Character-level state machine ═══════════════════════
    processChar(ch) {
        switch (this.internalState) {
            case 'TEXT':
                this.processTextChar(ch);
                break;
            case 'FENCE_MAYBE':
                this.processFenceChar(ch);
                break;
            case 'COMPONENT':
                this.processComponentChar(ch);
                break;
        }
    }
    /**
     * In TEXT state: accumulate normal text, watch for ``` fence start.
     */
    processTextChar(ch) {
        this.fenceAccum += ch;
        // We're looking for: ```livellm:<type>\n
        // Build up the fence accumulator to detect ``` at line start
        if (this.fenceAccum === '`' || this.fenceAccum === '``') {
            // Partial backtick sequence — keep accumulating
            return;
        }
        if (this.fenceAccum === '```') {
            // Three backticks — might be a fence, switch to FENCE_MAYBE
            this.internalState = 'FENCE_MAYBE';
            return;
        }
        // Not a fence — flush the fence accumulator to text
        this.textAccum += this.fenceAccum;
        this.fenceAccum = '';
        this.textDirty = true;
    }
    /**
     * In FENCE_MAYBE state: we have ```, now check if it's livellm: or not.
     */
    processFenceChar(ch) {
        this.fenceAccum += ch;
        // We need to accumulate until we can determine if this is ```livellm:<type>\n
        const afterBackticks = this.fenceAccum.substring(3); // Everything after ```
        if (ch === '\n') {
            // End of the info line — check if it's a livellm component
            const info = afterBackticks.slice(0, -1).trim(); // Remove the \n
            const livellmMatch = info.match(/^livellm:([\w][\w-]*)$/);
            if (livellmMatch) {
                // It's a livellm component! Flush any pending text and start buffering
                this.flushText();
                this.componentType = livellmMatch[1];
                this.componentJson = '';
                this.internalState = 'COMPONENT';
                this.fenceAccum = '';
                this.events.emit('stream:component:start', this.componentType);
                this.config.onComponentStart?.(this.componentType);
                this.insertSkeleton(this.componentType);
            }
            else {
                // Regular code fence — treat as normal text
                this.textAccum += this.fenceAccum;
                this.fenceAccum = '';
                this.internalState = 'TEXT';
                this.textDirty = true;
            }
        }
        else if (afterBackticks.length > 50) {
            // Too long for a fence info string — treat as text
            this.textAccum += this.fenceAccum;
            this.fenceAccum = '';
            this.internalState = 'TEXT';
            this.textDirty = true;
        }
        // Otherwise keep accumulating in FENCE_MAYBE
    }
    /**
     * In COMPONENT state: buffering JSON body of a livellm block.
     */
    processComponentChar(ch) {
        this.componentJson += ch;
        // Look for the closing \n```
        if (this.componentJson.endsWith('\n```')) {
            // Component is complete!
            const jsonStr = this.componentJson.slice(0, -4).trim();
            const type = this.componentType;
            this.componentJson = '';
            this.componentType = '';
            this.fenceAccum = '';
            this.internalState = 'TEXT';
            this.finalizeComponent(type, jsonStr);
        }
    }
    // ═══ Rendering ═══════════════════════════════════════════
    /**
     * Schedule a DOM render on the next animation frame.
     */
    scheduleRender() {
        if (this.renderRAF !== null)
            return;
        if (!this.textDirty)
            return;
        this.renderRAF = requestAnimationFrame(() => {
            this.renderRAF = null;
            if (this.textDirty) {
                this.renderCurrentText();
                this.textDirty = false;
            }
        });
    }
    /**
     * Render the current text accumulator as markdown.
     */
    renderCurrentText() {
        if (!this.textAccum.trim())
            return;
        const html = this.parser.parse(this.textAccum);
        if (!this.textBlock) {
            this.textBlock = document.createElement('div');
            this.textBlock.className = 'livellm-stream-block livellm-prose';
            this.container.appendChild(this.textBlock);
        }
        this.textBlock.innerHTML = html;
        this.moveCursorToEnd();
        if (this.config.autoScroll) {
            scrollToBottom(this.container);
        }
    }
    /**
     * Flush accumulated text and start a new text block.
     */
    flushText() {
        if (this.textAccum.trim()) {
            this.renderCurrentText();
        }
        this.textAccum = '';
        this.textBlock = null;
        this.textDirty = false;
    }
    /**
     * Replace skeleton with the real Web Component.
     */
    finalizeComponent(type, jsonStr) {
        try {
            const props = JSON.parse(jsonStr);
            const registration = this.registry.get(type);
            if (this.pendingElement) {
                if (registration) {
                    const finalProps = this.registry.applyDefaults(type, props);
                    const validation = this.registry.validate(type, props);
                    if (validation.valid) {
                        const componentEl = document.createElement(registration.tagName);
                        componentEl.setAttribute('data-livellm', type);
                        componentEl.setAttribute('data-props', JSON.stringify(finalProps));
                        this.pendingElement.replaceWith(componentEl);
                        this.events.emit('renderer:component:mounted', type, componentEl);
                    }
                    else {
                        // Validation failed — show error
                        this.replaceWithError(type, jsonStr, validation.errors);
                    }
                }
                else {
                    // Unknown component — show fallback
                    this.replaceWithFallback(type, jsonStr);
                }
            }
            this.pendingElement = null;
            this.config.onComponentComplete?.(type, props);
            this.events.emit('stream:component:complete', type, props);
        }
        catch {
            this.flushComponentAsFallback();
        }
        // Start new text block for anything after the component
        this.textBlock = null;
    }
    replaceWithFallback(type, content) {
        if (!this.pendingElement)
            return;
        const fallback = document.createElement('div');
        fallback.className = 'livellm-fallback';
        fallback.innerHTML =
            `<pre><code class="language-livellm:${this.escapeHtml(type)}">${this.escapeHtml(content)}</code></pre>`;
        this.pendingElement.replaceWith(fallback);
        this.pendingElement = null;
    }
    replaceWithError(type, content, errors) {
        if (!this.pendingElement)
            return;
        const errorList = errors.map((e) => `<li>${this.escapeHtml(e.message)}</li>`).join('');
        const errorEl = document.createElement('div');
        errorEl.className = 'livellm-error';
        errorEl.innerHTML =
            `<div class="livellm-error-header">Component "${this.escapeHtml(type)}" — validation errors:</div>` +
                `<ul class="livellm-error-list">${errorList}</ul>` +
                `<pre><code>${this.escapeHtml(content)}</code></pre>`;
        this.pendingElement.replaceWith(errorEl);
        this.pendingElement = null;
    }
    flushComponentAsFallback() {
        if (!this.pendingElement)
            return;
        this.replaceWithFallback(this.componentType, this.componentJson);
        this.componentType = '';
        this.componentJson = '';
    }
    // ═══ Skeleton ════════════════════════════════════════════
    insertSkeleton(type) {
        // Close current text block
        this.flushText();
        const skeleton = this.registry.getSkeleton(type);
        this.pendingElement = document.createElement('div');
        this.pendingElement.className = 'livellm-skeleton-wrapper';
        this.pendingElement.setAttribute('data-pending', type);
        this.pendingElement.innerHTML = skeleton.html;
        this.pendingElement.style.minHeight = skeleton.height;
        this.container.appendChild(this.pendingElement);
        if (this.config.autoScroll) {
            scrollToBottom(this.container);
        }
    }
    // ═══ Cursor ══════════════════════════════════════════════
    createCursor() {
        this.cursorElement = document.createElement('span');
        this.cursorElement.className = 'livellm-cursor';
        this.cursorElement.textContent = this.config.cursorChar;
        this.cursorElement.setAttribute('aria-hidden', 'true');
    }
    moveCursorToEnd() {
        if (!this.cursorElement)
            return;
        this.cursorElement.remove();
        this.container.appendChild(this.cursorElement);
    }
    removeCursor() {
        this.cursorElement?.remove();
        this.cursorElement = null;
    }
    // ═══ Utils ═══════════════════════════════════════════════
    escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

class Observer {
    constructor(events, registry, parser, renderer) {
        this.observer = null;
        this.target = null;
        this.debounceTimer = null;
        this.options = {
            childList: true,
            characterData: true,
            subtree: true,
            debounce: 100,
        };
        this.events = events;
        this.registry = registry;
        this.parser = parser;
        this.renderer = renderer;
    }
    /**
     * Start observing a target element for livellm: blocks.
     */
    observe(options) {
        if (typeof MutationObserver === 'undefined') {
            console.warn('[LiveLLM Observer] MutationObserver not available');
            return;
        }
        // Resolve target element
        if (typeof options.target === 'string') {
            this.target = document.querySelector(options.target);
        }
        else {
            this.target = options.target;
        }
        if (!this.target) {
            console.error('[LiveLLM Observer] Target element not found');
            return;
        }
        // Merge options
        if (options.childList !== undefined)
            this.options.childList = options.childList;
        if (options.characterData !== undefined)
            this.options.characterData = options.characterData;
        if (options.subtree !== undefined)
            this.options.subtree = options.subtree;
        if (options.debounce !== undefined)
            this.options.debounce = options.debounce;
        // Stop any existing observer
        this.disconnect();
        this.observer = new MutationObserver((mutations) => {
            this.handleMutations(mutations);
        });
        this.observer.observe(this.target, {
            childList: this.options.childList,
            characterData: this.options.characterData,
            subtree: this.options.subtree,
        });
        this.events.emit('observer:started', this.target);
        // Initial scan
        this.scanTarget();
    }
    /**
     * Stop observing.
     */
    disconnect() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
            this.events.emit('observer:stopped');
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }
    /**
     * Check if currently observing.
     */
    get isObserving() {
        return this.observer !== null;
    }
    /**
     * Handle incoming mutations with debouncing.
     */
    handleMutations(_mutations) {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.scanTarget();
        }, this.options.debounce);
    }
    /**
     * Scan the target element for unprocessed livellm: code blocks.
     */
    scanTarget() {
        if (!this.target)
            return;
        // Find all <code> elements that contain livellm: blocks and haven't been processed
        const codeBlocks = this.target.querySelectorAll('code:not([data-livellm-processed])');
        let processed = 0;
        codeBlocks.forEach((codeEl) => {
            const text = codeEl.textContent || '';
            // Check if this is a livellm: block pattern
            if (text.startsWith('livellm:')) {
                const preEl = codeEl.parentElement;
                if (preEl && preEl.tagName === 'PRE') {
                    this.processCodeBlock(preEl, text);
                    codeEl.setAttribute('data-livellm-processed', 'true');
                    processed++;
                }
            }
        });
        if (processed > 0) {
            this.events.emit('observer:processed', processed);
        }
    }
    /**
     * Process a single code block — parse and replace with component.
     */
    processCodeBlock(preEl, rawText) {
        // Parse "livellm:componentName\n{json}" format
        const newlineIdx = rawText.indexOf('\n');
        if (newlineIdx === -1)
            return;
        const header = rawText.substring(0, newlineIdx).trim();
        const componentName = header.replace('livellm:', '').trim();
        const jsonStr = rawText.substring(newlineIdx + 1).trim();
        if (!componentName || !this.registry.has(componentName))
            return;
        try {
            const props = JSON.parse(jsonStr);
            const registration = this.registry.get(componentName);
            if (!registration)
                return;
            // Create the web component element
            const tagName = registration.tagName;
            const componentEl = document.createElement(tagName);
            componentEl.setAttribute('data-livellm', componentName);
            componentEl.setAttribute('data-props', JSON.stringify(props));
            // Replace the <pre> with the component
            preEl.replaceWith(componentEl);
            this.events.emit('observer:component-rendered', { name: componentName, props });
        }
        catch (err) {
            console.error(`[LiveLLM Observer] Failed to process ${componentName}:`, err);
        }
    }
}

/**
 * LiveLLM — Main facade class.
 * Orchestrates all modules and provides the public API.
 */
class LiveLLMInstance {
    constructor() {
        this.initialized = false;
        this.version = '0.1.0';
        this.config = { ...DEFAULT_CONFIG };
        this.events = new EventBus();
        this._registry = new Registry(this.events);
        this.parser = new Parser(this.events, this._registry, this.config.markdown);
        this._renderer = new Renderer(this.events, this._registry, this.parser, this.config.renderer);
        this._transformer = new Transformer(this.events, this.config.transformer);
        this._transformer.registerBuiltIns();
        this.actions = new Actions(this.events, this.config.actions);
        this._observer = new Observer(this.events, this._registry, this.parser, this._renderer);
    }
    /**
     * Initialize LiveLLM with configuration.
     */
    init(userConfig = {}) {
        this.config = mergeConfig(DEFAULT_CONFIG, userConfig);
        this.events.setDebug(this.config.debug);
        // Reinitialize modules with updated config, preserving the existing registry
        // (built-in components are registered on the singleton at import time)
        this.parser = new Parser(this.events, this._registry, this.config.markdown);
        this._renderer = new Renderer(this.events, this._registry, this.parser, this.config.renderer);
        this._transformer = new Transformer(this.events, this.config.transformer);
        this._transformer.registerBuiltIns();
        this.actions = new Actions(this.events, this.config.actions);
        this._observer = new Observer(this.events, this._registry, this.parser, this._renderer);
        this.initialized = true;
    }
    // ═══ Rendering ═══════════════════════════════════════════
    /**
     * Render markdown into a container element.
     */
    render(markdown, target) {
        const enriched = this.config.transformer.mode !== 'off'
            ? this._transformer.transform(markdown)
            : markdown;
        return this._renderer.render(enriched, target);
    }
    /**
     * Render markdown to an HTML string.
     */
    renderToString(markdown) {
        const enriched = this.config.transformer.mode !== 'off'
            ? this._transformer.transform(markdown)
            : markdown;
        return this._renderer.renderToString(enriched);
    }
    // ═══ Streaming ═══════════════════════════════════════════
    /**
     * Create a stream renderer for token-by-token rendering.
     */
    createStreamRenderer(target, options = {}) {
        return new StreamRenderer(this.events, this._registry, this.parser, this._renderer, target, options);
    }
    // ═══ Transformer ════════════════════════════════════════
    /**
     * Transform raw markdown by detecting and enriching patterns.
     */
    transform(markdown) {
        return this._transformer.transform(markdown);
    }
    /**
     * Access the transformer for advanced configuration.
     */
    get transformer() {
        return this._transformer;
    }
    // ═══ Registry ═══════════════════════════════════════════
    /**
     * Register a component.
     */
    register(name, component, options = {}) {
        this._registry.register(name, component, options);
    }
    /**
     * Access the registry for advanced operations.
     */
    get registry() {
        return this._registry;
    }
    // ═══ Events ═════════════════════════════════════════════
    /**
     * Listen to an event.
     */
    on(event, handler) {
        this.events.on(event, handler);
    }
    /**
     * Remove an event listener.
     */
    off(event, handler) {
        this.events.off(event, handler);
    }
    /**
     * Listen to an event once.
     */
    once(event, handler) {
        this.events.once(event, handler);
    }
    // ═══ Observer ═════════════════════════════════════════
    /**
     * Start observing a container for dynamic livellm: blocks.
     */
    observe(options) {
        this._observer.observe(options);
    }
    /**
     * Stop observing.
     */
    disconnect() {
        this._observer.disconnect();
    }
    /**
     * Access the observer instance.
     */
    get observer() {
        return this._observer;
    }
    // ═══ Lifecycle ══════════════════════════════════════════
    /**
     * Destroy the LiveLLM instance and clean up.
     */
    destroy() {
        this._observer.disconnect();
        this.events.removeAll();
        this._registry.clear();
        this.initialized = false;
    }
    /**
     * Reset to initial state with default config.
     */
    reset() {
        this.destroy();
        this.config = { ...DEFAULT_CONFIG };
        this.events = new EventBus();
        this._registry = new Registry(this.events);
        this.parser = new Parser(this.events, this._registry, this.config.markdown);
        this._renderer = new Renderer(this.events, this._registry, this.parser, this.config.renderer);
        this._transformer = new Transformer(this.events, this.config.transformer);
        this._transformer.registerBuiltIns();
        this.actions = new Actions(this.events, this.config.actions);
        this._observer = new Observer(this.events, this._registry, this.parser, this._renderer);
    }
}

/**
 * LiveLLMComponent — Base class for all LiveLLM Web Components.
 * All built-in and custom components should extend this class.
 */
class LiveLLMComponent extends HTMLElement {
    constructor() {
        super();
        this._props = {};
        this._componentId = '';
        this.attachShadow({ mode: 'open' });
    }
    static get observedAttributes() {
        return ['data-props', 'data-livellm'];
    }
    attributeChangedCallback(name, oldVal, newVal) {
        if (name === 'data-props' && newVal) {
            try {
                this._props = JSON.parse(newVal);
                if (this.isConnected) {
                    this.update();
                }
            }
            catch {
                console.error('[LiveLLM] Invalid JSON in data-props:', newVal);
            }
        }
    }
    connectedCallback() {
        const propsAttr = this.getAttribute('data-props');
        if (propsAttr) {
            try {
                this._props = JSON.parse(propsAttr);
            }
            catch {
                console.error('[LiveLLM] Invalid JSON in data-props');
            }
        }
        this._componentId =
            this.getAttribute('data-component-id') || this._generateId();
        this.render();
    }
    disconnectedCallback() {
        // Override in subclasses for cleanup
    }
    /**
     * Get the component's props.
     */
    get props() {
        return this._props;
    }
    /**
     * Get the component's unique instance ID.
     */
    get componentId() {
        return this._componentId;
    }
    /**
     * Emit a LiveLLM action event that bubbles through Shadow DOM.
     */
    emitAction(action, data) {
        this.dispatchEvent(new CustomEvent('livellm:action', {
            bubbles: true,
            composed: true, // Traverses Shadow DOM boundary
            detail: {
                component: this.getAttribute('data-livellm') || '',
                action,
                data,
                timestamp: Date.now(),
                componentId: this._componentId,
            },
        }));
    }
    /**
     * Access a CSS custom property from the theme.
     */
    getThemeVar(name, fallback = '') {
        return (getComputedStyle(this)
            .getPropertyValue(`--livellm-${name}`)
            .trim() || fallback);
    }
    /**
     * Inject styles into the Shadow DOM.
     */
    setStyles(css) {
        if (!this.shadowRoot)
            return;
        let styleEl = this.shadowRoot.querySelector('style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            this.shadowRoot.prepend(styleEl);
        }
        styleEl.textContent = css;
    }
    /**
     * Set the Shadow DOM content (HTML string).
     */
    setContent(html) {
        if (!this.shadowRoot)
            return;
        // Preserve <style> element if it exists
        const styleEl = this.shadowRoot.querySelector('style');
        const styleText = styleEl?.textContent || '';
        this.shadowRoot.innerHTML = '';
        if (styleText) {
            const newStyle = document.createElement('style');
            newStyle.textContent = styleText;
            this.shadowRoot.appendChild(newStyle);
        }
        const wrapper = document.createElement('div');
        wrapper.className = 'livellm-component';
        wrapper.innerHTML = html;
        this.shadowRoot.appendChild(wrapper);
    }
    /**
     * Update the component when props change.
     * Default implementation re-renders.
     */
    update() {
        this.render();
    }
    _generateId() {
        const type = this.getAttribute('data-livellm') || 'component';
        return `livellm-${type}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    }
}

// ═══════════════════════════════════════════════════════════════
// LiveLLM Response Protocol — Type Definitions
//
// Standardized contract for server ↔ client communication.
// Covers SSE streaming, static responses, and bidirectional actions.
// ═══════════════════════════════════════════════════════════════
// ─── Type Guards ────────────────────────────────────────────
const VALID_EVENT_TYPES = ['token', 'error', 'metadata', 'done'];
/**
 * Check if a value is a valid StreamEvent.
 */
function isStreamEvent(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const obj = value;
    if (typeof obj.type !== 'string')
        return false;
    return VALID_EVENT_TYPES.includes(obj.type);
}
function isTokenEvent(event) {
    return event.type === 'token';
}
function isErrorEvent(event) {
    return event.type === 'error';
}
function isMetadataEvent(event) {
    return event.type === 'metadata';
}
function isDoneEvent(event) {
    return event.type === 'done';
}

// ═══════════════════════════════════════════════════════════════
// LiveLLM Response Protocol — Server Helpers
//
// Utilities for any Node.js server to emit SSE events
// conforming to the LiveLLM protocol.
// ═══════════════════════════════════════════════════════════════
/**
 * Create an SSE writer bound to a server response object.
 *
 * @example
 * ```js
 * import { createSSEWriter } from 'livellm/protocol';
 *
 * app.post('/api/chat/stream', (req, res) => {
 *   const sse = createSSEWriter(res);
 *   sse.writeHeaders();
 *   sse.metadata({ model: 'llama-3.3-70b', provider: 'groq' });
 *
 *   // For each token from the LLM:
 *   sse.token('Hello');
 *   sse.token(' world');
 *
 *   // On completion:
 *   sse.done();
 * });
 * ```
 */
function createSSEWriter(res) {
    const writeLine = (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    return {
        writeHeaders() {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
        },
        token(text) {
            writeLine({ type: 'token', token: text });
        },
        error(code, message, recoverable = false) {
            writeLine({ type: 'error', code, message, recoverable });
        },
        metadata(meta) {
            writeLine({ type: 'metadata', ...meta });
        },
        done(fullText) {
            const event = { type: 'done' };
            if (fullText !== undefined) {
                event.fullText = fullText;
            }
            writeLine(event);
            res.end();
        },
    };
}
/**
 * Format a LiveLLMActionPayload into a natural language string
 * suitable for injecting into the LLM conversation history.
 *
 * @example
 * ```js
 * const text = formatActionAsMessage(action);
 * // "User selected: React (from choice component)"
 * history.push({ role: 'user', content: text });
 * ```
 */
function formatActionAsMessage(action) {
    const parts = [];
    if (action.context) {
        parts.push(`[Re: "${action.context}"]`);
    }
    switch (action.action) {
        case 'select':
            parts.push(`User selected: ${action.label}`);
            break;
        case 'confirm': {
            let msg = 'User confirmed';
            if (action.label && action.label !== 'Yes') {
                msg += `: ${action.label}`;
            }
            parts.push(msg);
            break;
        }
        case 'cancel': {
            let msg = 'User cancelled';
            if (action.label && action.label !== 'No') {
                msg += `: ${action.label}`;
            }
            parts.push(msg);
            break;
        }
        case 'submit':
            parts.push(`User submitted: ${JSON.stringify(action.value)}`);
            break;
        case 'change':
            parts.push(`User set ${action.label || action.component} to: ${action.value}`);
            break;
        default:
            parts.push(`User action (${action.action}): ${action.label || JSON.stringify(action.value)}`);
    }
    return parts.join(' ');
}

// ═══════════════════════════════════════════════════════════════
// LiveLLM Response Protocol — Client Helpers
//
// Utilities for parsing SSE events and connecting to StreamRenderer.
// ═══════════════════════════════════════════════════════════════
/**
 * Parse a single SSE data line into a typed StreamEvent.
 *
 * Expects the raw line content (already stripped of the `data: ` prefix).
 * Returns `null` for unparseable or unknown event types.
 *
 * @example
 * ```ts
 * const event = parseSSEData('{"type":"token","token":"Hello"}');
 * // { type: 'token', token: 'Hello' }
 * ```
 */
function parseSSEData(data) {
    if (!data || !data.trim())
        return null;
    try {
        const parsed = JSON.parse(data);
        if (isStreamEvent(parsed)) {
            return parsed;
        }
        // Backwards compatibility: bare {token: "..."} format (pre-protocol)
        if (typeof parsed === 'object' && parsed !== null && 'token' in parsed && typeof parsed.token === 'string') {
            return { type: 'token', token: parsed.token };
        }
        return null;
    }
    catch {
        return null;
    }
}
/**
 * Parse a full SSE line (including `data: ` prefix) into a StreamEvent.
 * Returns `null` if the line is not a valid SSE data line.
 */
function parseSSELine(line) {
    if (!line.startsWith('data: '))
        return null;
    const data = line.slice(6).trim();
    return parseSSEData(data);
}
/**
 * Connect a fetch Response (SSE stream) to a StreamRenderer
 * using the LiveLLM protocol.
 *
 * Replaces the manual SSE parsing loop typically written in application code.
 * Handles token events, metadata, errors, and the done signal.
 *
 * @example
 * ```ts
 * import LiveLLM from 'livellm';
 * import { connectLiveLLMStream } from 'livellm/protocol';
 *
 * const sr = LiveLLM.createStreamRenderer('#output');
 * const response = await fetch('/api/chat/stream', { method: 'POST', ... });
 *
 * await connectLiveLLMStream(response, sr, {
 *   onMetadata: (meta) => console.log('Model:', meta.model),
 *   onError: (err) => console.error('Stream error:', err.message),
 * });
 * ```
 */
async function connectLiveLLMStream(response, streamRenderer, options = {}) {
    if (!response.body) {
        throw new Error('[LiveLLM Protocol] Response has no body');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (!line.startsWith('data: '))
                    continue;
                const data = line.slice(6).trim();
                // Legacy compatibility: plain [DONE] string
                if (data === '[DONE]') {
                    streamRenderer.end();
                    options.onDone?.({ type: 'done' });
                    return;
                }
                const event = parseSSEData(data);
                if (!event)
                    continue;
                switch (event.type) {
                    case 'token':
                        streamRenderer.push(event.token);
                        break;
                    case 'metadata':
                        options.onMetadata?.(event);
                        break;
                    case 'error':
                        options.onError?.(event);
                        if (!event.recoverable) {
                            streamRenderer.end();
                            return;
                        }
                        break;
                    case 'done':
                        streamRenderer.end();
                        options.onDone?.(event);
                        return;
                }
            }
        }
        // Stream ended without explicit done event
        streamRenderer.end();
    }
    catch (err) {
        streamRenderer.end();
        throw err;
    }
}

const ALERT_STYLES = `
  :host {
    display: block;
    margin: 8px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
  }
  .alert {
    padding: 12px 16px;
    border-radius: var(--livellm-border-radius, 8px);
    border-left: 4px solid;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .alert-icon {
    flex-shrink: 0;
    font-size: 16px;
    line-height: 1.6;
  }
  .alert-text {
    flex: 1;
    word-break: break-word;
  }
  .alert-info {
    background: #e8f4fd;
    border-color: var(--livellm-info, #74b9ff);
    color: #1a5276;
  }
  .alert-success {
    background: #e8f8f5;
    border-color: var(--livellm-success, #00cec9);
    color: #1a6e5e;
  }
  .alert-warning {
    background: #fef9e7;
    border-color: var(--livellm-warning, #fdcb6e);
    color: #7d6608;
  }
  .alert-error {
    background: #fdedec;
    border-color: var(--livellm-danger, #ff6b6b);
    color: #922b21;
  }
`;
const ICONS = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
};
class LiveLLMAlert extends LiveLLMComponent {
    render() {
        const type = this._props.type || 'info';
        const text = this._props.text || '';
        const icon = ICONS[type] || ICONS.info;
        this.setStyles(ALERT_STYLES);
        this.setContent(`
      <div class="alert alert-${type}" role="alert">
        <span class="alert-icon">${icon}</span>
        <span class="alert-text">${this.escapeHtml(text)}</span>
      </div>
    `);
    }
    escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}
const ALERT_REGISTRATION = {
    schema: {
        type: {
            type: 'enum',
            enum: ['info', 'success', 'warning', 'error'],
            default: 'info',
        },
        text: { type: 'string', required: true },
    },
    category: 'inline',
    skeleton: {
        html: '<div class="livellm-skeleton" style="height:48px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '48px',
    },
};

const BADGE_STYLES = `
  :host {
    display: inline-block;
    vertical-align: middle;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 12px;
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.5;
    white-space: nowrap;
    transition: var(--livellm-transition, 0.2s ease);
  }
  .badge-solid-green {
    background: var(--livellm-success, #00cec9);
    color: #fff;
  }
  .badge-solid-red {
    background: var(--livellm-danger, #ff6b6b);
    color: #fff;
  }
  .badge-solid-blue {
    background: var(--livellm-info, #74b9ff);
    color: #fff;
  }
  .badge-solid-yellow {
    background: var(--livellm-warning, #fdcb6e);
    color: #333;
  }
  .badge-solid-gray {
    background: #adb5bd;
    color: #fff;
  }
  .badge-solid-purple {
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
  }
  .badge-outline-green {
    border: 1.5px solid var(--livellm-success, #00cec9);
    color: var(--livellm-success, #00cec9);
    background: transparent;
  }
  .badge-outline-red {
    border: 1.5px solid var(--livellm-danger, #ff6b6b);
    color: var(--livellm-danger, #ff6b6b);
    background: transparent;
  }
  .badge-outline-blue {
    border: 1.5px solid var(--livellm-info, #74b9ff);
    color: var(--livellm-info, #74b9ff);
    background: transparent;
  }
  .badge-outline-yellow {
    border: 1.5px solid var(--livellm-warning, #fdcb6e);
    color: var(--livellm-warning, #fdcb6e);
    background: transparent;
  }
  .badge-outline-gray {
    border: 1.5px solid #adb5bd;
    color: #adb5bd;
    background: transparent;
  }
  .badge-outline-purple {
    border: 1.5px solid var(--livellm-primary, #6c5ce7);
    color: var(--livellm-primary, #6c5ce7);
    background: transparent;
  }
`;
class LiveLLMBadge extends LiveLLMComponent {
    render() {
        const text = this._props.text || '';
        const color = this._props.color || 'blue';
        const variant = this._props.variant || 'solid';
        this.setStyles(BADGE_STYLES);
        this.setContent(`
      <span class="badge badge-${variant}-${color}">${this.escapeHtml(text)}</span>
    `);
    }
    escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}
const BADGE_REGISTRATION = {
    schema: {
        text: { type: 'string', required: true },
        color: {
            type: 'enum',
            enum: ['green', 'red', 'blue', 'yellow', 'gray', 'purple'],
            default: 'blue',
        },
        variant: {
            type: 'enum',
            enum: ['solid', 'outline'],
            default: 'solid',
        },
    },
    category: 'inline',
    skeleton: {
        html: '<span style="display:inline-block;width:60px;height:20px;border-radius:12px;background:#e0e0e0;"></span>',
        height: '20px',
    },
};

const PROGRESS_STYLES = `
  :host {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    vertical-align: middle;
  }
  .progress-wrapper {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: 12px;
  }
  .progress-bar {
    display: inline-block;
    width: 100px;
    height: 8px;
    background: var(--livellm-bg-secondary, #f0f0f0);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }
  .progress-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  .progress-label {
    font-weight: 600;
    color: var(--livellm-text, #1a1a1a);
    white-space: nowrap;
  }
  .progress-text {
    color: var(--livellm-text-secondary, #6c757d);
    font-size: 11px;
  }
`;
class LiveLLMProgress extends LiveLLMComponent {
    render() {
        const value = this._props.value ?? 0;
        const max = this._props.max ?? 100;
        const label = this._props.label || '';
        const color = this._props.color || 'var(--livellm-primary, #6c5ce7)';
        const pct = Math.min(100, Math.max(0, (value / max) * 100));
        this.setStyles(PROGRESS_STYLES);
        this.setContent(`
      <span class="progress-wrapper">
        ${label ? `<span class="progress-text">${this.escapeHtml(label)}</span>` : ''}
        <span class="progress-bar">
          <span class="progress-fill" style="width:${pct}%;background:${color}"></span>
        </span>
        <span class="progress-label">${Math.round(pct)}%</span>
      </span>
    `);
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const PROGRESS_REGISTRATION = {
    schema: {
        value: { type: 'number', required: true, min: 0 },
        max: { type: 'number', default: 100, min: 1 },
        label: { type: 'string', default: '' },
        color: { type: 'string', default: '' },
    },
    category: 'inline',
    skeleton: {
        html: '<span style="display:inline-block;width:120px;height:10px;border-radius:4px;background:#e0e0e0;"></span>',
        height: '10px',
    },
};

const TOOLTIP_STYLES = `
  :host {
    display: inline;
    position: relative;
  }
  .tooltip-trigger {
    display: inline;
    border-bottom: 1px dashed var(--livellm-primary, #6c5ce7);
    color: var(--livellm-primary, #6c5ce7);
    cursor: help;
    font-family: inherit;
    font-size: inherit;
    position: relative;
  }
  .tooltip-popup {
    display: none;
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: #1a1a2e;
    color: #e8e8f0;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.4;
    white-space: nowrap;
    max-width: 250px;
    white-space: normal;
    z-index: 1000;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  .tooltip-popup::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: #1a1a2e;
  }
  .tooltip-trigger:hover .tooltip-popup {
    display: block;
  }
`;
class LiveLLMTooltip extends LiveLLMComponent {
    render() {
        const text = this._props.text || '';
        const tip = this._props.tip || '';
        this.setStyles(TOOLTIP_STYLES);
        this.setContent(`
      <span class="tooltip-trigger">
        ${this.escapeHtml(text)}
        <span class="tooltip-popup">${this.escapeHtml(tip)}</span>
      </span>
    `);
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const TOOLTIP_REGISTRATION = {
    schema: {
        text: { type: 'string', required: true },
        tip: { type: 'string', required: true },
    },
    category: 'inline',
    skeleton: {
        html: '<span style="display:inline-block;width:60px;height:16px;border-radius:2px;background:#e0e0e0;"></span>',
        height: '16px',
    },
};

const RATING_STYLES$1 = `
  :host {
    display: inline-flex;
    vertical-align: middle;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  .rating-star { font-size: 16px; line-height: 1; }
  .rating-star.filled { color: #f9ca24; }
  .rating-star.empty { color: var(--livellm-border, #e0e0e0); }
  .rating-star.half { position: relative; }
  .rating-star.half::before {
    content: '\u2605';
    color: #f9ca24;
    position: absolute;
    overflow: hidden;
    width: 50%;
  }
  .rating-value {
    margin-left: 4px;
    font-size: 13px;
    font-weight: 600;
    color: var(--livellm-text-secondary, #6c757d);
  }
`;
class LiveLLMRating extends LiveLLMComponent {
    render() {
        const value = this._props.value ?? 0;
        const max = this._props.max ?? 5;
        const showValue = this._props.showValue ?? true;
        this.setStyles(RATING_STYLES$1);
        const stars = Array.from({ length: max }, (_, i) => {
            if (i < Math.floor(value)) {
                return '<span class="rating-star filled">\u2605</span>';
            }
            else if (i < value) {
                return '<span class="rating-star half">\u2606</span>';
            }
            else {
                return '<span class="rating-star empty">\u2606</span>';
            }
        }).join('');
        const valueText = showValue ? `<span class="rating-value">${value}/${max}</span>` : '';
        this.setContent(`${stars}${valueText}`);
    }
}
const RATING_REGISTRATION = {
    schema: {
        value: { type: 'number', required: true, min: 0 },
        max: { type: 'number', default: 5, min: 1 },
        showValue: { type: 'boolean', default: true },
    },
    category: 'inline',
    skeleton: {
        html: '<span style="display:inline-block;width:100px;height:16px;background:#e0e0e0;border-radius:4px;"></span>',
        height: '16px',
    },
};

const COUNTER_STYLES = `
  :host {
    display: inline-flex;
    vertical-align: middle;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .counter-value {
    font-size: 24px;
    font-weight: 800;
    color: var(--livellm-primary, #6c5ce7);
    font-variant-numeric: tabular-nums;
  }
  .counter-label {
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    font-weight: 500;
  }
  .counter-suffix {
    font-size: 16px;
    font-weight: 600;
    color: var(--livellm-primary, #6c5ce7);
  }
  .counter-group {
    display: inline-flex;
    align-items: baseline;
    gap: 2px;
  }
`;
class LiveLLMCounter extends LiveLLMComponent {
    render() {
        const value = this._props.value ?? 0;
        const label = this._props.label || '';
        const prefix = this._props.prefix || '';
        const suffix = this._props.suffix || '';
        const format = this._props.format || 'number'; // number, compact, percent
        this.setStyles(COUNTER_STYLES);
        let displayValue;
        switch (format) {
            case 'compact':
                displayValue = this.formatCompact(value);
                break;
            case 'percent':
                displayValue = `${value}`;
                break;
            default:
                displayValue = value.toLocaleString();
        }
        const displaySuffix = format === 'percent' ? '%' : suffix;
        this.setContent(`
      ${label ? `<span class="counter-label">${this.escapeHtml(label)}</span>` : ''}
      <span class="counter-group">
        ${prefix ? `<span class="counter-suffix">${this.escapeHtml(prefix)}</span>` : ''}
        <span class="counter-value">${this.escapeHtml(displayValue)}</span>
        ${displaySuffix ? `<span class="counter-suffix">${this.escapeHtml(displaySuffix)}</span>` : ''}
      </span>
    `);
    }
    formatCompact(n) {
        if (n >= 1000000000)
            return (n / 1000000000).toFixed(1) + 'B';
        if (n >= 1000000)
            return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000)
            return (n / 1000).toFixed(1) + 'K';
        return String(n);
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const COUNTER_REGISTRATION = {
    schema: {
        value: { type: 'number', required: true },
        label: { type: 'string', default: '' },
        prefix: { type: 'string', default: '' },
        suffix: { type: 'string', default: '' },
        format: { type: 'string', default: 'number' },
    },
    category: 'inline',
    skeleton: {
        html: '<span style="display:inline-block;width:60px;height:24px;background:#e0e0e0;border-radius:4px;"></span>',
        height: '24px',
    },
};

const TAG_STYLES = `
  :host {
    display: inline-flex;
    vertical-align: middle;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    display: inline-flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.4;
    transition: var(--livellm-transition, 0.2s ease);
  }
  .tag-icon { margin-right: 4px; }
  .tag.clickable { cursor: pointer; }
  .tag.clickable:hover { opacity: 0.8; transform: scale(1.02); }
  /* Colors */
  .tag.blue { background: #dbeafe; color: #1e40af; }
  .tag.green { background: #dcfce7; color: #166534; }
  .tag.red { background: #fef2f2; color: #991b1b; }
  .tag.yellow { background: #fefce8; color: #854d0e; }
  .tag.purple { background: #f3e8ff; color: #6b21a8; }
  .tag.gray { background: #f3f4f6; color: #374151; }
  .tag.orange { background: #fff7ed; color: #9a3412; }
  .tag.pink { background: #fdf2f8; color: #9d174d; }
  .tag.outline {
    background: transparent;
    border: 1px solid currentColor;
  }
`;
class LiveLLMTag extends LiveLLMComponent {
    render() {
        const tags = this._props.tags || [];
        const variant = this._props.variant || 'solid';
        const clickable = this._props.clickable ?? false;
        const defaultColor = this._props.color || 'blue';
        this.setStyles(TAG_STYLES);
        const tagsHtml = tags.map((tag, i) => {
            const item = typeof tag === 'string' ? { text: tag } : tag;
            const color = item.color || defaultColor;
            const classes = ['tag', color];
            if (variant === 'outline')
                classes.push('outline');
            if (clickable)
                classes.push('clickable');
            return `<span class="${classes.join(' ')}" data-index="${i}">
        ${item.icon ? `<span class="tag-icon">${this.escapeHtml(item.icon)}</span>` : ''}
        ${this.escapeHtml(item.text)}
      </span>`;
        }).join('');
        this.setContent(tagsHtml);
        if (clickable) {
            this.shadowRoot?.querySelectorAll('.tag').forEach(tag => {
                tag.addEventListener('click', (e) => {
                    const idx = parseInt(e.currentTarget.getAttribute('data-index') || '0', 10);
                    const item = tags[idx];
                    const text = typeof item === 'string' ? item : item.text;
                    this.emitAction('tag-click', {
                        value: text,
                        label: `Clicked tag: ${text}`,
                        index: idx,
                    });
                });
            });
        }
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const TAG_REGISTRATION = {
    schema: {
        tags: { type: 'array', required: true },
        color: { type: 'string', default: 'blue' },
        variant: { type: 'string', default: 'solid' },
        clickable: { type: 'boolean', default: false },
    },
    category: 'inline',
    skeleton: {
        html: '<span style="display:inline-block;width:80px;height:20px;background:#e0e0e0;border-radius:12px;"></span>',
        height: '20px',
    },
};

const TABS_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .tabs-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    overflow: hidden;
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .tabs-header {
    display: flex;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
    overflow-x: auto;
  }
  .tab-button {
    flex-shrink: 0;
    padding: 10px 20px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: var(--livellm-text-secondary, #6c757d);
    border-bottom: 2px solid transparent;
    transition: var(--livellm-transition, 0.2s ease);
    white-space: nowrap;
  }
  .tab-button:hover {
    color: var(--livellm-text, #1a1a1a);
    background: rgba(0, 0, 0, 0.03);
  }
  .tab-button.active {
    color: var(--livellm-primary, #6c5ce7);
    border-bottom-color: var(--livellm-primary, #6c5ce7);
    font-weight: 600;
  }
  .tab-panel {
    display: none;
    padding: 16px;
    line-height: var(--livellm-line-height, 1.6);
    background: var(--livellm-bg-component, #ffffff);
  }
  .tab-panel.active {
    display: block;
  }
`;
class LiveLLMTabs extends LiveLLMComponent {
    constructor() {
        super(...arguments);
        this.activeTab = 0;
    }
    render() {
        const rawTabs = this._props.tabs || this._props.items || this._props.sections || this._props.panels || [];
        const tabs = Array.isArray(rawTabs)
            ? rawTabs.map((t) => this.normalizeTab(t))
            : [];
        const defaultTab = this._props.defaultTab ?? 0;
        this.activeTab = defaultTab;
        this.setStyles(TABS_STYLES);
        const headerButtons = tabs
            .map((tab, i) => `<button class="tab-button${i === this.activeTab ? ' active' : ''}" data-tab-index="${i}">${this.escapeHtml(tab.label)}</button>`)
            .join('');
        const panels = tabs
            .map((tab, i) => `<div class="tab-panel${i === this.activeTab ? ' active' : ''}" data-tab-panel="${i}">${this.escapeHtml(tab.content)}</div>`)
            .join('');
        this.setContent(`
      <div class="tabs-container">
        <div class="tabs-header">${headerButtons}</div>
        ${panels}
      </div>
    `);
        // Add click listeners
        this.shadowRoot?.querySelectorAll('.tab-button').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const index = parseInt(target.getAttribute('data-tab-index') || '0', 10);
                this.switchTab(index);
            });
        });
    }
    switchTab(index) {
        if (!this.shadowRoot)
            return;
        this.activeTab = index;
        // Update buttons
        this.shadowRoot.querySelectorAll('.tab-button').forEach((btn, i) => {
            btn.classList.toggle('active', i === index);
        });
        // Update panels
        this.shadowRoot.querySelectorAll('.tab-panel').forEach((panel, i) => {
            panel.classList.toggle('active', i === index);
        });
        const rawTabs = this._props.tabs || this._props.items || this._props.sections || this._props.panels || [];
        const tabs = Array.isArray(rawTabs) ? rawTabs.map((t) => this.normalizeTab(t)) : [];
        const tab = tabs[index];
        if (tab) {
            this.emitAction('tab-switch', {
                value: { index, label: tab.label },
                label: `Switched to tab: ${tab.label}`,
            });
        }
    }
    normalizeTab(tab) {
        if (typeof tab === 'string') {
            return { label: tab, content: tab };
        }
        if (!tab || typeof tab !== 'object') {
            return { label: String(tab ?? ''), content: '' };
        }
        return {
            label: String(tab.label ?? tab.title ?? tab.name ?? tab.header ?? ''),
            content: String(tab.content ?? tab.body ?? tab.text ?? tab.description ?? ''),
        };
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const TABS_REGISTRATION = {
    schema: {
        tabs: { type: 'array' },
        items: { type: 'array' },
        sections: { type: 'array' },
        panels: { type: 'array' },
        defaultTab: { type: 'number', default: 0, min: 0 },
    },
    category: 'block',
    skeleton: {
        html: '<div style="height:150px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '150px',
    },
};

const MAP_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .map-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    overflow: hidden;
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .map-frame {
    width: 100%;
    border: none;
    display: block;
  }
  .map-header {
    padding: 10px 16px;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .map-icon { font-size: 16px; }
  .map-title {
    font-weight: 600;
    font-size: 13px;
  }
  .map-address {
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
  }
  .map-footer {
    padding: 8px 16px;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-top: 1px solid var(--livellm-border, #e0e0e0);
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .map-link {
    color: var(--livellm-primary, #6c5ce7);
    text-decoration: none;
    font-weight: 500;
  }
  .map-link:hover { text-decoration: underline; }
`;
class LiveLLMMap extends LiveLLMComponent {
    render() {
        const lat = this._props.lat ?? 0;
        const lng = this._props.lng ?? 0;
        const zoom = this._props.zoom ?? 13;
        const title = this._props.title || '';
        const address = this._props.address || '';
        const height = this._props.height || '300px';
        // Use OpenStreetMap embed (no API key required)
        const bbox = this.calculateBbox(lat, lng, zoom);
        const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
        const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
        this.setStyles(MAP_STYLES);
        let headerHtml = '';
        if (title || address) {
            headerHtml = `
        <div class="map-header">
          <span class="map-icon">📍</span>
          <div>
            ${title ? `<div class="map-title">${this.escapeHtml(title)}</div>` : ''}
            ${address ? `<div class="map-address">${this.escapeHtml(address)}</div>` : ''}
          </div>
        </div>`;
        }
        this.setContent(`
      <div class="map-container">
        ${headerHtml}
        <iframe class="map-frame"
          src="${this.escapeAttr(osmUrl)}"
          height="${height}"
          loading="lazy"
          referrerpolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin">
        </iframe>
        <div class="map-footer">
          <span>${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
          <a class="map-link" href="${this.escapeAttr(osmLink)}" target="_blank" rel="noopener noreferrer">
            Open in OpenStreetMap
          </a>
        </div>
      </div>
    `);
        // Emit action when clicking the map link
        this.shadowRoot?.querySelector('.map-link')?.addEventListener('click', () => {
            this.emitAction('open-map', {
                value: { lat, lng, title, address },
                label: title
                    ? `Opened map for: ${title}`
                    : `Opened map at ${lat}, ${lng}`,
            });
        });
    }
    calculateBbox(lat, lng, zoom) {
        const delta = 180 / Math.pow(2, zoom);
        return `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    escapeAttr(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const MAP_REGISTRATION = {
    schema: {
        lat: { type: 'number', required: true },
        lng: { type: 'number', required: true },
        zoom: { type: 'number', default: 13, min: 1, max: 20 },
        title: { type: 'string', default: '' },
        address: { type: 'string', default: '' },
        height: { type: 'string', default: '300px' },
        markers: { type: 'array', default: [] },
    },
    category: 'block',
    skeleton: {
        html: '<div class="livellm-skeleton" style="height:300px;border-radius:8px;background:#d5e8d4;"><div class="shimmer"></div></div>',
        height: '300px',
    },
};

const CHART_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .chart-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    background: var(--livellm-bg-component, #ffffff);
  }
  .chart-title {
    font-weight: 600;
    font-size: 15px;
    margin-bottom: 16px;
    text-align: center;
  }
  .chart-svg { width: 100%; overflow: visible; }
  .bar { transition: opacity 0.2s; cursor: pointer; }
  .bar:hover { opacity: 0.8; }
  .chart-label {
    font-size: 11px;
    fill: var(--livellm-text-secondary, #6c757d);
    text-anchor: middle;
  }
  .chart-value {
    font-size: 11px;
    fill: var(--livellm-text, #1a1a1a);
    text-anchor: middle;
    font-weight: 600;
  }
  .axis-line { stroke: var(--livellm-border, #e0e0e0); stroke-width: 1; }
  .grid-line { stroke: var(--livellm-border, #e0e0e0); stroke-width: 0.5; opacity: 0.5; }
  .legend {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
  }
  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .pie-slice { cursor: pointer; transition: opacity 0.2s; }
  .pie-slice:hover { opacity: 0.8; }
`;
const DEFAULT_COLORS = ['#6c5ce7', '#00cec9', '#fdcb6e', '#ff6b6b', '#74b9ff', '#a29bfe', '#55efc4', '#fab1a0'];
class LiveLLMChart extends LiveLLMComponent {
    render() {
        const chartType = this._props.type || 'bar';
        const title = this._props.title || '';
        const rawLabels = this._props.labels || this._props.categories || this._props.xAxis || [];
        const labels = Array.isArray(rawLabels) ? rawLabels.map((l) => String(l ?? '')) : [];
        const rawDatasets = this._props.datasets || this._props.series || this._props.data || [];
        const datasets = Array.isArray(rawDatasets)
            ? rawDatasets.map((ds) => this.normalizeDataset(ds))
            : [];
        const legend = this._props.legend !== false;
        this.setStyles(CHART_STYLES);
        let chartHtml = '';
        switch (chartType) {
            case 'bar':
                chartHtml = this.renderBarChart(labels, datasets);
                break;
            case 'pie':
            case 'doughnut':
                chartHtml = this.renderPieChart(labels, datasets, chartType === 'doughnut');
                break;
            case 'line':
                chartHtml = this.renderLineChart(labels, datasets);
                break;
            default:
                chartHtml = this.renderBarChart(labels, datasets);
        }
        const legendHtml = legend && datasets.length > 0 ? this.renderLegend(datasets) : '';
        this.setContent(`
      <div class="chart-container">
        ${title ? `<div class="chart-title">${this.escapeHtml(title)}</div>` : ''}
        ${chartHtml}
        ${legendHtml}
      </div>
    `);
        this.bindChartEvents();
    }
    renderBarChart(labels, datasets) {
        if (!datasets.length || !labels.length)
            return '<p>No data</p>';
        const width = 400;
        const height = 200;
        const padding = { top: 20, right: 20, bottom: 40, left: 10 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;
        const allValues = datasets.flatMap((d) => d.data);
        const maxVal = Math.max(...allValues, 1);
        const groupWidth = chartW / labels.length;
        const barWidth = (groupWidth * 0.7) / datasets.length;
        const groupPad = groupWidth * 0.15;
        let bars = '';
        let valueLabels = '';
        let xLabels = '';
        labels.forEach((label, i) => {
            const x = padding.left + i * groupWidth;
            datasets.forEach((ds, di) => {
                const val = ds.data[i] || 0;
                const barH = (val / maxVal) * chartH;
                const barX = x + groupPad + di * barWidth;
                const barY = padding.top + chartH - barH;
                const color = ds.color || DEFAULT_COLORS[di % DEFAULT_COLORS.length];
                bars += `<rect class="bar" x="${barX}" y="${barY}" width="${barWidth}" height="${barH}" fill="${color}" rx="2" data-index="${i}" data-dataset="${di}" data-value="${val}" data-label="${this.escapeAttr(label)}"/>`;
                valueLabels += `<text class="chart-value" x="${barX + barWidth / 2}" y="${barY - 4}">${this.formatNumber(val)}</text>`;
            });
            xLabels += `<text class="chart-label" x="${x + groupWidth / 2}" y="${height - 8}">${this.escapeHtml(this.truncate(label, 12))}</text>`;
        });
        // Grid lines
        let gridLines = '';
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartH / 4) * i;
            gridLines += `<line class="grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"/>`;
        }
        return `
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        ${gridLines}
        <line class="axis-line" x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right}" y2="${padding.top + chartH}"/>
        ${bars}
        ${valueLabels}
        ${xLabels}
      </svg>`;
    }
    renderPieChart(labels, datasets, doughnut) {
        if (!datasets.length || !datasets[0].data.length)
            return '<p>No data</p>';
        const data = datasets[0].data;
        const total = data.reduce((s, v) => s + v, 0);
        if (total === 0)
            return '<p>No data</p>';
        const cx = 150;
        const cy = 100;
        const r = 80;
        const innerR = doughnut ? 45 : 0;
        let slices = '';
        let startAngle = -Math.PI / 2;
        data.forEach((val, i) => {
            const angle = (val / total) * 2 * Math.PI;
            const endAngle = startAngle + angle;
            const largeArc = angle > Math.PI ? 1 : 0;
            const x1 = cx + r * Math.cos(startAngle);
            const y1 = cy + r * Math.sin(startAngle);
            const x2 = cx + r * Math.cos(endAngle);
            const y2 = cy + r * Math.sin(endAngle);
            let d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
            if (innerR > 0) {
                const ix1 = cx + innerR * Math.cos(endAngle);
                const iy1 = cy + innerR * Math.sin(endAngle);
                const ix2 = cx + innerR * Math.cos(startAngle);
                const iy2 = cy + innerR * Math.sin(startAngle);
                d += ` L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
            }
            else {
                d += ` L ${cx} ${cy} Z`;
            }
            const color = DEFAULT_COLORS[i % DEFAULT_COLORS.length];
            const label = labels[i] || `Item ${i + 1}`;
            slices += `<path class="pie-slice" d="${d}" fill="${color}" data-index="${i}" data-value="${val}" data-label="${this.escapeAttr(label)}"/>`;
            startAngle = endAngle;
        });
        return `
      <svg class="chart-svg" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid meet">
        ${slices}
      </svg>`;
    }
    renderLineChart(labels, datasets) {
        if (!datasets.length || !labels.length)
            return '<p>No data</p>';
        const width = 400;
        const height = 200;
        const padding = { top: 20, right: 20, bottom: 40, left: 10 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;
        const allValues = datasets.flatMap((d) => d.data);
        const maxVal = Math.max(...allValues, 1);
        let lines = '';
        let dots = '';
        let xLabels = '';
        datasets.forEach((ds, di) => {
            const color = ds.color || DEFAULT_COLORS[di % DEFAULT_COLORS.length];
            const points = [];
            ds.data.forEach((val, i) => {
                const x = padding.left + (i / (labels.length - 1 || 1)) * chartW;
                const y = padding.top + chartH - (val / maxVal) * chartH;
                points.push(`${x},${y}`);
                dots += `<circle cx="${x}" cy="${y}" r="3" fill="${color}" data-index="${i}" data-dataset="${di}" data-value="${val}"/>`;
            });
            lines += `<polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`;
        });
        labels.forEach((label, i) => {
            const x = padding.left + (i / (labels.length - 1 || 1)) * chartW;
            xLabels += `<text class="chart-label" x="${x}" y="${height - 8}">${this.escapeHtml(this.truncate(label, 10))}</text>`;
        });
        let gridLines = '';
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartH / 4) * i;
            gridLines += `<line class="grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"/>`;
        }
        return `
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        ${gridLines}
        <line class="axis-line" x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right}" y2="${padding.top + chartH}"/>
        ${lines}
        ${dots}
        ${xLabels}
      </svg>`;
    }
    renderLegend(datasets) {
        const items = datasets.map((ds, i) => {
            const color = ds.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
            return `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span>${this.escapeHtml(ds.label)}</div>`;
        }).join('');
        return `<div class="legend">${items}</div>`;
    }
    bindChartEvents() {
        this.shadowRoot?.querySelectorAll('.bar, .pie-slice').forEach((el) => {
            el.addEventListener('click', () => {
                const htmlEl = el;
                const label = htmlEl.getAttribute('data-label') || '';
                const value = htmlEl.getAttribute('data-value') || '';
                this.emitAction('segment-click', {
                    value: { label, value: parseFloat(value) },
                    label: `Selected: ${label} (${value})`,
                });
            });
        });
    }
    formatNumber(n) {
        if (n >= 1000000)
            return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000)
            return (n / 1000).toFixed(1) + 'K';
        return n.toString();
    }
    truncate(str, max) {
        return str.length > max ? str.substring(0, max - 1) + '…' : str;
    }
    normalizeDataset(ds) {
        if (Array.isArray(ds)) {
            return { label: '', data: ds.map((v) => Number(v) || 0) };
        }
        if (!ds || typeof ds !== 'object') {
            return { label: '', data: [] };
        }
        return {
            label: String(ds.label ?? ds.name ?? ds.title ?? ''),
            data: Array.isArray(ds.data || ds.values) ? (ds.data || ds.values).map((v) => Number(v) || 0) : [],
            color: ds.color ?? ds.backgroundColor ?? undefined,
        };
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    escapeAttr(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const CHART_REGISTRATION = {
    schema: {
        type: { type: 'enum', enum: ['bar', 'line', 'pie', 'doughnut', 'area', 'radar', 'scatter'], default: 'bar' },
        title: { type: 'string', default: '' },
        labels: { type: 'array' },
        categories: { type: 'array' },
        xAxis: { type: 'array' },
        datasets: { type: 'array' },
        series: { type: 'array' },
        data: { type: 'array' },
        legend: { type: 'boolean', default: true },
        responsive: { type: 'boolean', default: true },
    },
    category: 'block',
    skeleton: {
        html: '<div class="livellm-skeleton" style="height:250px;border-radius:8px;background:#e8e8ff;"><div class="shimmer"></div></div>',
        height: '250px',
    },
};

const FORM_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .form-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    overflow: hidden;
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    background: var(--livellm-bg-component, #ffffff);
  }
  .form-title {
    padding: 12px 16px;
    font-weight: 600;
    font-size: 15px;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
  }
  .form-body { padding: 16px; }
  .field {
    margin-bottom: 14px;
  }
  .field:last-child { margin-bottom: 0; }
  .field-label {
    display: block;
    margin-bottom: 4px;
    font-weight: 500;
    font-size: 13px;
    color: var(--livellm-text, #1a1a1a);
  }
  .field-label .required {
    color: var(--livellm-danger, #ff6b6b);
    margin-left: 2px;
  }
  input, select, textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    color: var(--livellm-text, #1a1a1a);
    background: var(--livellm-bg, #ffffff);
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }
  input:focus, select:focus, textarea:focus {
    border-color: var(--livellm-primary, #6c5ce7);
    box-shadow: 0 0 0 2px rgba(108, 92, 231, 0.15);
  }
  textarea { resize: vertical; min-height: 60px; }
  .checkbox-field {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .checkbox-field input {
    width: auto;
  }
  .submit-btn {
    display: block;
    width: 100%;
    padding: 10px;
    margin-top: 16px;
    background: var(--livellm-primary, #6c5ce7);
    color: white;
    border: none;
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .submit-btn:hover { background: var(--livellm-primary-dark, #5a4bd1); }
  .submit-btn:active { transform: translateY(1px); }
`;
class LiveLLMForm extends LiveLLMComponent {
    render() {
        const title = this._props.title || '';
        const rawFields = this._props.fields || this._props.inputs || this._props.items || [];
        const fields = Array.isArray(rawFields) ? rawFields : [];
        const submitLabel = this._props.submitLabel || this._props.buttonText || this._props.submit || 'Submit';
        const prefill = this._props.prefill || this._props.defaults || this._props.values || {};
        this.setStyles(FORM_STYLES);
        const fieldsHtml = fields.map((f) => this.renderField(f, prefill[f.name])).join('');
        this.setContent(`
      <div class="form-container">
        ${title ? `<div class="form-title">${this.escapeHtml(title)}</div>` : ''}
        <div class="form-body">
          <form>
            ${fieldsHtml}
            <button type="submit" class="submit-btn">${this.escapeHtml(submitLabel)}</button>
          </form>
        </div>
      </div>
    `);
        this.shadowRoot?.querySelector('form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit(fields);
        });
    }
    renderField(field, prefillValue) {
        const req = field.required ? '<span class="required">*</span>' : '';
        const label = `<label class="field-label">${this.escapeHtml(field.label)}${req}</label>`;
        const val = prefillValue !== undefined ? this.escapeAttr(String(prefillValue)) : '';
        const ph = field.placeholder ? `placeholder="${this.escapeAttr(field.placeholder)}"` : '';
        switch (field.type) {
            case 'textarea':
                return `<div class="field">${label}<textarea name="${this.escapeAttr(field.name)}" rows="${field.rows || 3}" ${field.required ? 'required' : ''} ${ph}>${this.escapeHtml(val)}</textarea></div>`;
            case 'select':
                const opts = (field.options || []).map((o) => {
                    const sel = o === val ? ' selected' : '';
                    return `<option value="${this.escapeAttr(o)}"${sel}>${this.escapeHtml(o)}</option>`;
                }).join('');
                return `<div class="field">${label}<select name="${this.escapeAttr(field.name)}" ${field.required ? 'required' : ''}><option value="">-- Select --</option>${opts}</select></div>`;
            case 'checkbox':
                const checked = prefillValue ? ' checked' : '';
                return `<div class="field"><div class="checkbox-field"><input type="checkbox" name="${this.escapeAttr(field.name)}"${checked}><label class="field-label" style="margin:0">${this.escapeHtml(field.label)}</label></div></div>`;
            case 'radio':
                const radios = (field.options || []).map((o) => {
                    const ch = o === val ? ' checked' : '';
                    return `<div class="checkbox-field"><input type="radio" name="${this.escapeAttr(field.name)}" value="${this.escapeAttr(o)}"${ch}><span>${this.escapeHtml(o)}</span></div>`;
                }).join('');
                return `<div class="field">${label}${radios}</div>`;
            default:
                return `<div class="field">${label}<input type="${this.escapeAttr(field.type || 'text')}" name="${this.escapeAttr(field.name)}" value="${val}" ${field.required ? 'required' : ''} ${ph}/></div>`;
        }
    }
    handleSubmit(fields) {
        const form = this.shadowRoot?.querySelector('form');
        if (!form)
            return;
        const data = {};
        fields.forEach((f) => {
            if (f.type === 'checkbox') {
                const input = form.querySelector(`[name="${f.name}"]`);
                data[f.name] = input?.checked || false;
            }
            else {
                const input = form.querySelector(`[name="${f.name}"]`);
                data[f.name] = input?.value || '';
            }
        });
        const summary = fields
            .filter((f) => data[f.name] && data[f.name] !== '' && data[f.name] !== false)
            .map((f) => `${f.label}: ${data[f.name]}`)
            .join(', ');
        this.emitAction('submit', {
            value: data,
            label: `Form submitted: ${summary}`,
        });
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    escapeAttr(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const FORM_REGISTRATION = {
    schema: {
        title: { type: 'string', default: '' },
        fields: { type: 'array' },
        inputs: { type: 'array' },
        items: { type: 'array' },
        submitLabel: { type: 'string', default: 'Submit' },
        buttonText: { type: 'string' },
        submit: { type: 'string' },
        prefill: { type: 'object' },
        defaults: { type: 'object' },
        values: { type: 'object' },
    },
    category: 'block',
    skeleton: {
        html: '<div class="livellm-skeleton" style="height:200px;border-radius:8px;background:#f0f0f0;"><div class="shimmer"></div></div>',
        height: '200px',
    },
};

const TABLE_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .table-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    overflow: hidden;
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    background: var(--livellm-bg-component, #ffffff);
  }
  .table-toolbar {
    padding: 10px 16px;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .search-input {
    padding: 6px 10px;
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: 6px;
    font-family: inherit;
    font-size: 13px;
    outline: none;
    width: 200px;
    max-width: 50%;
  }
  .search-input:focus {
    border-color: var(--livellm-primary, #6c5ce7);
  }
  .row-count {
    font-size: 12px;
    color: var(--livellm-text-muted, #adb5bd);
  }
  .table-scroll { overflow-x: auto; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    padding: 10px 16px;
    text-align: left;
    font-weight: 600;
    color: var(--livellm-text-secondary, #6c757d);
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-bottom: 2px solid var(--livellm-border, #e0e0e0);
    white-space: nowrap;
    user-select: none;
  }
  th.sortable {
    cursor: pointer;
  }
  th.sortable:hover { color: var(--livellm-primary, #6c5ce7); }
  th .sort-arrow {
    margin-left: 4px;
    opacity: 0.3;
    font-size: 10px;
  }
  th.sorted-asc .sort-arrow,
  th.sorted-desc .sort-arrow { opacity: 1; color: var(--livellm-primary, #6c5ce7); }
  td {
    padding: 10px 16px;
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
  }
  tr:last-child td { border-bottom: none; }
  tr.clickable { cursor: pointer; }
  tr.clickable:hover { background: rgba(108, 92, 231, 0.04); }
  tr.selected { background: rgba(108, 92, 231, 0.08); }
  .pagination {
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-top: 1px solid var(--livellm-border, #e0e0e0);
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
  }
  .page-btn {
    padding: 4px 10px;
    border: 1px solid var(--livellm-border, #e0e0e0);
    background: var(--livellm-bg, #ffffff);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }
  .page-btn:hover { background: var(--livellm-bg-secondary, #f8f9fa); }
  .page-btn:disabled { opacity: 0.5; cursor: default; }
  .page-btns { display: flex; gap: 4px; }
  .no-results {
    padding: 24px;
    text-align: center;
    color: var(--livellm-text-muted, #adb5bd);
  }
`;
class LiveLLMTablePlus extends LiveLLMComponent {
    constructor() {
        super(...arguments);
        this.sortKey = '';
        this.sortDir = 'asc';
        this.searchQuery = '';
        this.currentPage = 0;
        this.selectedRows = new Set();
    }
    render() {
        const rawRows = this._props.rows || this._props.data || this._props.items || this._props.records || [];
        const rows = Array.isArray(rawRows) ? rawRows : [];
        const rawColumns = this._props.columns || this._props.headers || [];
        let columns = Array.isArray(rawColumns)
            ? rawColumns.map((col) => this.normalizeColumn(col))
            : [];
        // Auto-generate columns from first row if none provided
        if (columns.length === 0 && rows.length > 0) {
            columns = Object.keys(rows[0]).map((key) => ({
                key,
                label: key.charAt(0).toUpperCase() + key.slice(1),
                sortable: true,
            }));
        }
        const searchable = this._props.searchable !== false;
        const sortable = this._props.sortable !== false;
        const pageSize = this._props.pageSize || 0;
        const selectable = this._props.selectable || false;
        this.setStyles(TABLE_STYLES);
        let filteredRows = rows;
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filteredRows = rows.filter((row) => columns.some((col) => String(row[col.key] ?? '').toLowerCase().includes(q)));
        }
        if (this.sortKey) {
            const col = columns.find((c) => c.key === this.sortKey);
            filteredRows = [...filteredRows].sort((a, b) => {
                const av = a[this.sortKey] ?? '';
                const bv = b[this.sortKey] ?? '';
                const cmp = col?.type === 'number'
                    ? (parseFloat(av) || 0) - (parseFloat(bv) || 0)
                    : String(av).localeCompare(String(bv));
                return this.sortDir === 'asc' ? cmp : -cmp;
            });
        }
        let displayRows = filteredRows;
        const totalPages = pageSize > 0 ? Math.ceil(filteredRows.length / pageSize) : 1;
        if (pageSize > 0) {
            const start = this.currentPage * pageSize;
            displayRows = filteredRows.slice(start, start + pageSize);
        }
        // Build HTML
        const toolbarHtml = searchable ? `
      <div class="table-toolbar">
        <input class="search-input" type="text" placeholder="Search..." value="${this.escapeAttr(this.searchQuery)}"/>
        <span class="row-count">${filteredRows.length} row${filteredRows.length !== 1 ? 's' : ''}</span>
      </div>` : '';
        const headCells = columns.map((col) => {
            const isSortable = sortable && col.sortable !== false;
            const cls = [
                isSortable ? 'sortable' : '',
                this.sortKey === col.key ? `sorted-${this.sortDir}` : '',
            ].filter(Boolean).join(' ');
            const arrow = isSortable
                ? `<span class="sort-arrow">${this.sortKey === col.key ? (this.sortDir === 'asc' ? '▲' : '▼') : '▲'}</span>`
                : '';
            return `<th class="${cls}" data-sort-key="${this.escapeAttr(col.key)}">${this.escapeHtml(col.label)}${arrow}</th>`;
        }).join('');
        let bodyHtml = '';
        if (displayRows.length === 0) {
            bodyHtml = `<tr><td colspan="${columns.length}" class="no-results">No results found</td></tr>`;
        }
        else {
            bodyHtml = displayRows.map((row, i) => {
                const origIdx = filteredRows.indexOf(row);
                const cls = [
                    'clickable' ,
                    this.selectedRows.has(origIdx) ? 'selected' : '',
                ].filter(Boolean).join(' ');
                const cells = columns.map((col) => `<td>${this.escapeHtml(String(row[col.key] ?? ''))}</td>`).join('');
                return `<tr class="${cls}" data-row-index="${origIdx}">${cells}</tr>`;
            }).join('');
        }
        const paginationHtml = pageSize > 0 && totalPages > 1 ? `
      <div class="pagination">
        <span>Page ${this.currentPage + 1} of ${totalPages}</span>
        <div class="page-btns">
          <button class="page-btn page-prev" ${this.currentPage === 0 ? 'disabled' : ''}>Prev</button>
          <button class="page-btn page-next" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''}>Next</button>
        </div>
      </div>` : '';
        this.setContent(`
      <div class="table-container">
        ${toolbarHtml}
        <div class="table-scroll">
          <table>
            <thead><tr>${headCells}</tr></thead>
            <tbody>${bodyHtml}</tbody>
          </table>
        </div>
        ${paginationHtml}
      </div>
    `);
        this.bindTableEvents(columns, filteredRows, sortable, selectable);
    }
    bindTableEvents(columns, rows, sortable, selectable) {
        // Search
        this.shadowRoot?.querySelector('.search-input')?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.currentPage = 0;
            this.render();
        });
        // Sort
        if (sortable) {
            this.shadowRoot?.querySelectorAll('th.sortable').forEach((th) => {
                th.addEventListener('click', () => {
                    const key = th.getAttribute('data-sort-key') || '';
                    if (this.sortKey === key) {
                        this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
                    }
                    else {
                        this.sortKey = key;
                        this.sortDir = 'asc';
                    }
                    this.render();
                });
            });
        }
        // Row click
        this.shadowRoot?.querySelectorAll('tr.clickable').forEach((tr) => {
            tr.addEventListener('click', () => {
                const idx = parseInt(tr.getAttribute('data-row-index') || '0', 10);
                const row = rows[idx];
                if (row) {
                    this.emitAction('row-click', {
                        value: { row, index: idx },
                        label: `Selected row: ${Object.values(row).join(', ')}`,
                    });
                }
            });
        });
        // Pagination
        this.shadowRoot?.querySelector('.page-prev')?.addEventListener('click', () => {
            if (this.currentPage > 0) {
                this.currentPage--;
                this.render();
            }
        });
        this.shadowRoot?.querySelector('.page-next')?.addEventListener('click', () => {
            this.currentPage++;
            this.render();
        });
    }
    normalizeColumn(col) {
        if (typeof col === 'string') {
            return { key: col, label: col };
        }
        if (!col || typeof col !== 'object') {
            return { key: String(col ?? ''), label: String(col ?? '') };
        }
        return {
            key: String(col.key ?? col.field ?? col.id ?? col.name ?? col.label ?? ''),
            label: String(col.label ?? col.title ?? col.header ?? col.name ?? col.key ?? ''),
            sortable: col.sortable,
            type: col.type,
        };
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    escapeAttr(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const TABLE_PLUS_REGISTRATION = {
    schema: {
        columns: { type: 'array' },
        headers: { type: 'array' },
        rows: { type: 'array' },
        data: { type: 'array' },
        items: { type: 'array' },
        records: { type: 'array' },
        searchable: { type: 'boolean', default: true },
        sortable: { type: 'boolean', default: true },
        pageSize: { type: 'number', default: 0 },
        selectable: { type: 'boolean', default: false },
    },
    category: 'block',
    skeleton: {
        html: '<div class="livellm-skeleton" style="height:200px;border-radius:8px;background:#f0f0f0;"><div class="shimmer"></div></div>',
        height: '200px',
    },
};

const ACCORDION_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .accordion-title {
    font-size: 1.05em;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--livellm-text, #1a1a1a);
  }
  .accordion {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    overflow: hidden;
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .accordion-item {
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
  }
  .accordion-item:last-child { border-bottom: none; }
  .accordion-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--livellm-bg-component, #ffffff);
    cursor: pointer;
    user-select: none;
    font-weight: 500;
    transition: background 0.15s;
    min-height: 20px;
  }
  .accordion-header:hover {
    background: var(--livellm-bg-secondary, #f8f9fa);
  }
  .accordion-header-text {
    flex: 1;
    margin-right: 8px;
  }
  .accordion-arrow {
    transition: transform 0.2s;
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
    flex-shrink: 0;
  }
  .accordion-item.open .accordion-arrow {
    transform: rotate(90deg);
  }
  .accordion-body {
    display: none;
    padding: 12px 16px;
    background: var(--livellm-bg, #ffffff);
    border-top: 1px solid var(--livellm-border, #e0e0e0);
    line-height: var(--livellm-line-height, 1.6);
    color: var(--livellm-text-secondary, #6c757d);
  }
  .accordion-item.open .accordion-body {
    display: block;
  }
`;
class LiveLLMAccordion extends LiveLLMComponent {
    render() {
        const rawItems = this._props.items || this._props.sections || [];
        const items = Array.isArray(rawItems)
            ? rawItems.map((item) => this.normalizeItem(item))
            : [];
        const exclusive = this._props.exclusive ?? true;
        const title = this._props.title || '';
        // Default to opening the first item if defaultOpen not specified
        const defaultOpen = this._props.defaultOpen ?? 0;
        this.setStyles(ACCORDION_STYLES);
        const titleHtml = title
            ? `<div class="accordion-title">${this.escapeHtml(title)}</div>`
            : '';
        const itemsHtml = items.map((item, i) => {
            const isOpen = defaultOpen === i ? ' open' : '';
            return `
        <div class="accordion-item${isOpen}" data-index="${i}">
          <div class="accordion-header">
            <span class="accordion-header-text">${this.escapeHtml(item.title)}</span>
            <span class="accordion-arrow">▶</span>
          </div>
          <div class="accordion-body">${this.escapeHtml(item.content)}</div>
        </div>`;
        }).join('');
        this.setContent(`${titleHtml}<div class="accordion">${itemsHtml}</div>`);
        this.shadowRoot?.querySelectorAll('.accordion-header').forEach((header) => {
            header.addEventListener('click', () => {
                const item = header.parentElement;
                const idx = parseInt(item.getAttribute('data-index') || '0', 10);
                const wasOpen = item.classList.contains('open');
                if (exclusive) {
                    this.shadowRoot?.querySelectorAll('.accordion-item').forEach((el) => {
                        el.classList.remove('open');
                    });
                }
                if (!wasOpen) {
                    item.classList.add('open');
                }
                this.emitAction('toggle', {
                    value: { index: idx, open: !wasOpen, title: items[idx]?.title },
                    label: `${wasOpen ? 'Closed' : 'Opened'}: ${items[idx]?.title || ''}`,
                });
            });
        });
    }
    normalizeItem(item) {
        if (!item || typeof item !== 'object') {
            return { title: String(item ?? ''), content: '' };
        }
        return {
            title: String(item.title ?? item.label ?? item.name ?? ''),
            content: String(item.content ?? item.body ?? item.description ?? item.text ?? ''),
        };
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const ACCORDION_REGISTRATION = {
    schema: {
        items: { type: 'array' },
        sections: { type: 'array' },
        title: { type: 'string' },
        exclusive: { type: 'boolean', default: true },
        defaultOpen: { type: 'number', default: 0 },
    },
    category: 'block',
    skeleton: {
        html: '<div class="livellm-skeleton" style="height:150px;border-radius:8px;background:#f0f0f0;"><div class="shimmer"></div></div>',
        height: '150px',
    },
};

const STEPS_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .steps-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 20px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .steps-title {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 16px;
  }
  .step {
    display: flex;
    gap: 14px;
    position: relative;
    padding-bottom: 20px;
  }
  .step:last-child { padding-bottom: 0; }
  .step-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }
  .step-number {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border: 2px solid var(--livellm-border, #e0e0e0);
    color: var(--livellm-text-secondary, #6c757d);
    z-index: 1;
  }
  .step.completed .step-number {
    background: var(--livellm-success, #00b894);
    border-color: var(--livellm-success, #00b894);
    color: #fff;
  }
  .step.active .step-number {
    background: var(--livellm-primary, #6c5ce7);
    border-color: var(--livellm-primary, #6c5ce7);
    color: #fff;
  }
  .step-line {
    width: 2px;
    flex: 1;
    background: var(--livellm-border, #e0e0e0);
    margin-top: 4px;
  }
  .step.completed .step-line {
    background: var(--livellm-success, #00b894);
  }
  .step-content { flex: 1; padding-top: 2px; }
  .step-label {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
  }
  .step-description {
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    line-height: var(--livellm-line-height, 1.6);
  }
`;
class LiveLLMSteps extends LiveLLMComponent {
    render() {
        const title = this._props.title || '';
        const rawSteps = this._props.steps || this._props.items || this._props.stages || [];
        const steps = Array.isArray(rawSteps)
            ? rawSteps.map((s) => this.normalizeStep(s))
            : [];
        const current = this._props.current ?? this._props.currentStep ?? -1;
        this.setStyles(STEPS_STYLES);
        const stepsHtml = steps.map((step, i) => {
            let status = step.status || 'pending';
            if (current >= 0) {
                if (i < current)
                    status = 'completed';
                else if (i === current)
                    status = 'active';
                else
                    status = 'pending';
            }
            const checkmark = status === 'completed' ? '\u2713' : `${i + 1}`;
            const showLine = i < steps.length - 1;
            return `
        <div class="step ${status}">
          <div class="step-indicator">
            <div class="step-number">${checkmark}</div>
            ${showLine ? '<div class="step-line"></div>' : ''}
          </div>
          <div class="step-content">
            <div class="step-label">${this.escapeHtml(step.label)}</div>
            ${step.description ? `<div class="step-description">${this.escapeHtml(step.description)}</div>` : ''}
          </div>
        </div>
      `;
        }).join('');
        this.setContent(`
      <div class="steps-container">
        ${title ? `<div class="steps-title">${this.escapeHtml(title)}</div>` : ''}
        ${stepsHtml}
      </div>
    `);
    }
    normalizeStep(step) {
        if (typeof step === 'string') {
            return { label: step };
        }
        if (!step || typeof step !== 'object') {
            return { label: String(step ?? '') };
        }
        return {
            label: String(step.label ?? step.title ?? step.name ?? step.text ?? ''),
            description: step.description ?? step.content ?? step.body ?? step.detail ?? undefined,
            status: step.status,
        };
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const STEPS_REGISTRATION = {
    schema: {
        title: { type: 'string', default: '' },
        steps: { type: 'array' },
        items: { type: 'array' },
        stages: { type: 'array' },
        current: { type: 'number', default: -1 },
        currentStep: { type: 'number' },
    },
    category: 'block',
    skeleton: {
        html: '<div style="height:200px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '200px',
    },
};

const TIMELINE_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .timeline-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 20px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .timeline-title {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 16px;
  }
  .timeline-item {
    display: flex;
    gap: 14px;
    position: relative;
    padding-bottom: 20px;
  }
  .timeline-item:last-child { padding-bottom: 0; }
  .timeline-marker-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }
  .timeline-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--livellm-primary, #6c5ce7);
    border: 2px solid var(--livellm-bg-component, #ffffff);
    box-shadow: 0 0 0 2px var(--livellm-primary, #6c5ce7);
    z-index: 1;
    flex-shrink: 0;
  }
  .timeline-line {
    width: 2px;
    flex: 1;
    background: var(--livellm-border, #e0e0e0);
    margin-top: 4px;
  }
  .timeline-content { flex: 1; padding-top: 0; }
  .timeline-date {
    font-size: 12px;
    color: var(--livellm-primary, #6c5ce7);
    font-weight: 600;
    margin-bottom: 2px;
  }
  .timeline-event-title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
  }
  .timeline-description {
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    line-height: var(--livellm-line-height, 1.6);
  }
`;
class LiveLLMTimeline extends LiveLLMComponent {
    render() {
        const title = this._props.title || '';
        const rawEvents = this._props.events || this._props.items || this._props.entries || [];
        const events = Array.isArray(rawEvents)
            ? rawEvents.map((e) => this.normalizeEvent(e))
            : [];
        this.setStyles(TIMELINE_STYLES);
        const eventsHtml = events.map((event, i) => {
            const showLine = i < events.length - 1;
            const dotStyle = event.color ? `background:${event.color};box-shadow:0 0 0 2px ${event.color};` : '';
            return `
        <div class="timeline-item">
          <div class="timeline-marker-col">
            <div class="timeline-dot" ${dotStyle ? `style="${dotStyle}"` : ''}></div>
            ${showLine ? '<div class="timeline-line"></div>' : ''}
          </div>
          <div class="timeline-content">
            <div class="timeline-date">${this.escapeHtml(event.date)}</div>
            <div class="timeline-event-title">${this.escapeHtml(event.title)}</div>
            ${event.description ? `<div class="timeline-description">${this.escapeHtml(event.description)}</div>` : ''}
          </div>
        </div>
      `;
        }).join('');
        this.setContent(`
      <div class="timeline-container">
        ${title ? `<div class="timeline-title">${this.escapeHtml(title)}</div>` : ''}
        ${eventsHtml}
      </div>
    `);
    }
    normalizeEvent(event) {
        if (typeof event === 'string') {
            return { date: '', title: event };
        }
        if (!event || typeof event !== 'object') {
            return { date: '', title: String(event ?? '') };
        }
        return {
            date: String(event.date ?? event.time ?? event.when ?? event.timestamp ?? ''),
            title: String(event.title ?? event.label ?? event.name ?? event.event ?? ''),
            description: event.description ?? event.content ?? event.body ?? event.detail ?? undefined,
            color: event.color,
        };
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const TIMELINE_REGISTRATION = {
    schema: {
        title: { type: 'string', default: '' },
        events: { type: 'array' },
        items: { type: 'array' },
        entries: { type: 'array' },
    },
    category: 'block',
    skeleton: {
        html: '<div style="height:200px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '200px',
    },
};

const VIDEO_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .video-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    overflow: hidden;
    background: #000;
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .video-wrapper {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%; /* 16:9 */
  }
  .video-wrapper iframe, .video-wrapper video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }
  .video-caption {
    padding: 10px 14px;
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    background: var(--livellm-bg-component, #ffffff);
    border-top: 1px solid var(--livellm-border, #e0e0e0);
  }
  .video-error {
    padding: 40px 20px;
    text-align: center;
    color: var(--livellm-text-secondary, #6c757d);
    background: var(--livellm-bg-secondary, #f8f9fa);
  }
`;
class LiveLLMVideo extends LiveLLMComponent {
    render() {
        const url = this._props.url || '';
        const caption = this._props.caption || '';
        const autoplay = this._props.autoplay ?? false;
        this.setStyles(VIDEO_STYLES);
        const embedUrl = this.getEmbedUrl(url);
        let videoHtml;
        if (embedUrl) {
            const autoplayParam = autoplay ? '&autoplay=1' : '';
            videoHtml = `
        <div class="video-wrapper">
          <iframe src="${this.escapeAttr(embedUrl)}${autoplayParam}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen loading="lazy"></iframe>
        </div>
      `;
        }
        else if (url && (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg'))) {
            videoHtml = `
        <div class="video-wrapper">
          <video controls ${autoplay ? 'autoplay muted' : ''} preload="metadata">
            <source src="${this.escapeAttr(url)}">
            Your browser does not support the video tag.
          </video>
        </div>
      `;
        }
        else {
            videoHtml = `<div class="video-error">Unable to embed video: ${this.escapeHtml(url || 'No URL provided')}</div>`;
        }
        this.setContent(`
      <div class="video-container">
        ${videoHtml}
        ${caption ? `<div class="video-caption">${this.escapeHtml(caption)}</div>` : ''}
      </div>
    `);
    }
    getEmbedUrl(url) {
        try {
            const u = new URL(url);
            // YouTube
            if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
                let videoId = '';
                if (u.hostname.includes('youtu.be')) {
                    videoId = u.pathname.slice(1);
                }
                else {
                    videoId = u.searchParams.get('v') || '';
                }
                if (videoId)
                    return `https://www.youtube.com/embed/${videoId}`;
            }
            // Vimeo
            if (u.hostname.includes('vimeo.com')) {
                const id = u.pathname.split('/').pop();
                if (id)
                    return `https://player.vimeo.com/video/${id}`;
            }
        }
        catch { }
        return null;
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    escapeAttr(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const VIDEO_REGISTRATION = {
    schema: {
        url: { type: 'string', required: true },
        caption: { type: 'string', default: '' },
        autoplay: { type: 'boolean', default: false },
    },
    category: 'block',
    skeleton: {
        html: '<div style="height:300px;border-radius:8px;background:#1a1a1a;"></div>',
        height: '300px',
    },
};

const PRICING_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .pricing-container {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding: 4px;
  }
  .pricing-card {
    flex: 1;
    min-width: 200px;
    border: 2px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    overflow: hidden;
    transition: var(--livellm-transition, 0.2s ease);
  }
  .pricing-card.highlighted {
    border-color: var(--livellm-primary, #6c5ce7);
    transform: scale(1.02);
    box-shadow: 0 4px 16px rgba(108, 92, 231, 0.15);
  }
  .pricing-badge {
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
    text-align: center;
    padding: 4px 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .pricing-header {
    padding: 20px 16px 0;
    text-align: center;
  }
  .pricing-name {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .pricing-price {
    font-size: 32px;
    font-weight: 800;
    color: var(--livellm-primary, #6c5ce7);
  }
  .pricing-price .currency { font-size: 18px; vertical-align: top; }
  .pricing-period {
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    margin-bottom: 16px;
  }
  .pricing-features {
    padding: 0 16px 16px;
    list-style: none;
    margin: 0;
  }
  .pricing-feature {
    padding: 6px 0;
    font-size: 13px;
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pricing-feature:last-child { border-bottom: none; }
  .pricing-check { color: var(--livellm-success, #00b894); }
  .pricing-cta {
    padding: 0 16px 20px;
    text-align: center;
  }
  .pricing-btn {
    display: inline-block;
    padding: 10px 24px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    transition: var(--livellm-transition, 0.2s ease);
    background: var(--livellm-bg-secondary, #f8f9fa);
    color: var(--livellm-text, #1a1a1a);
    width: 100%;
  }
  .pricing-card.highlighted .pricing-btn {
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
  }
  .pricing-btn:hover { opacity: 0.9; transform: translateY(-1px); }
`;
class LiveLLMPricing extends LiveLLMComponent {
    render() {
        const rawTiers = this._props.tiers || this._props.plans || this._props.items || this._props.pricing || [];
        const tiers = Array.isArray(rawTiers)
            ? rawTiers.map((t) => this.normalizeTier(t))
            : [];
        this.setStyles(PRICING_STYLES);
        const cardsHtml = tiers.map((tier, i) => {
            const currency = tier.currency || '$';
            const period = tier.period || '/month';
            const highlighted = tier.highlighted ?? false;
            const cta = tier.cta || 'Select';
            const featuresHtml = (tier.features || []).map(f => `<li class="pricing-feature"><span class="pricing-check">\u2713</span>${this.escapeHtml(f)}</li>`).join('');
            return `
        <div class="pricing-card${highlighted ? ' highlighted' : ''}">
          ${tier.badge ? `<div class="pricing-badge">${this.escapeHtml(tier.badge)}</div>` : ''}
          <div class="pricing-header">
            <div class="pricing-name">${this.escapeHtml(tier.name)}</div>
            <div class="pricing-price"><span class="currency">${this.escapeHtml(currency)}</span>${this.escapeHtml(String(tier.price))}</div>
            <div class="pricing-period">${this.escapeHtml(period)}</div>
          </div>
          <ul class="pricing-features">${featuresHtml}</ul>
          <div class="pricing-cta">
            <button class="pricing-btn" data-tier="${i}">${this.escapeHtml(cta)}</button>
          </div>
        </div>
      `;
        }).join('');
        this.setContent(`<div class="pricing-container">${cardsHtml}</div>`);
        this.shadowRoot?.querySelectorAll('.pricing-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-tier') || '0', 10);
                const tier = tiers[idx];
                if (tier) {
                    this.emitAction('pricing-select', {
                        value: tier.name,
                        label: `Selected plan: ${tier.name}`,
                        tier,
                    });
                }
            });
        });
    }
    normalizeTier(tier) {
        if (!tier || typeof tier !== 'object') {
            return { name: String(tier ?? ''), price: 0, features: [] };
        }
        const rawFeatures = tier.features || tier.items || tier.perks || tier.benefits || [];
        return {
            name: String(tier.name ?? tier.title ?? tier.label ?? tier.plan ?? ''),
            price: tier.price ?? tier.cost ?? tier.amount ?? 0,
            currency: tier.currency,
            period: tier.period ?? tier.billing ?? tier.interval,
            features: Array.isArray(rawFeatures) ? rawFeatures.map((f) => String(f ?? '')) : [],
            highlighted: tier.highlighted ?? tier.recommended ?? tier.popular ?? false,
            badge: tier.badge ?? tier.tag,
            cta: tier.cta ?? tier.button ?? tier.action,
        };
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const PRICING_REGISTRATION = {
    schema: {
        tiers: { type: 'array' },
        plans: { type: 'array' },
        items: { type: 'array' },
        pricing: { type: 'array' },
    },
    category: 'block',
    skeleton: {
        html: '<div style="height:300px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '300px',
    },
};

const CAROUSEL_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .carousel-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    overflow: hidden;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    position: relative;
  }
  .carousel-track {
    display: flex;
    transition: transform 0.3s ease;
  }
  .carousel-slide {
    min-width: 100%;
    box-sizing: border-box;
    padding: 20px;
  }
  .carousel-slide-title {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .carousel-slide-content {
    font-size: 14px;
    line-height: var(--livellm-line-height, 1.6);
    color: var(--livellm-text-secondary, #6c757d);
  }
  .carousel-slide img {
    max-width: 100%;
    border-radius: 6px;
    margin-bottom: 10px;
  }
  .carousel-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-top: 1px solid var(--livellm-border, #e0e0e0);
    background: var(--livellm-bg-secondary, #f8f9fa);
  }
  .carousel-btn {
    padding: 6px 14px;
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: 6px;
    background: var(--livellm-bg-component, #ffffff);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    color: var(--livellm-text, #1a1a1a);
    transition: var(--livellm-transition, 0.2s ease);
  }
  .carousel-btn:hover { background: var(--livellm-bg-secondary, #f8f9fa); border-color: var(--livellm-primary, #6c5ce7); }
  .carousel-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .carousel-dots {
    display: flex;
    gap: 6px;
  }
  .carousel-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--livellm-border, #e0e0e0);
    border: none;
    cursor: pointer;
    padding: 0;
    transition: var(--livellm-transition, 0.2s ease);
  }
  .carousel-dot.active { background: var(--livellm-primary, #6c5ce7); }
`;
class LiveLLMCarousel extends LiveLLMComponent {
    constructor() {
        super(...arguments);
        this.currentSlide = 0;
    }
    render() {
        const rawSlides = this._props.slides || this._props.items || this._props.cards || this._props.pages || [];
        const slides = Array.isArray(rawSlides)
            ? rawSlides.map((s) => this.normalizeSlide(s))
            : [];
        const loop = this._props.loop ?? false;
        this.setStyles(CAROUSEL_STYLES);
        const slidesHtml = slides.map(slide => `
      <div class="carousel-slide">
        ${slide.image ? `<img src="${this.escapeAttr(slide.image)}" alt="${this.escapeAttr(slide.title || '')}" loading="lazy" />` : ''}
        ${slide.title ? `<div class="carousel-slide-title">${this.escapeHtml(slide.title)}</div>` : ''}
        <div class="carousel-slide-content">${this.escapeHtml(slide.content)}</div>
      </div>
    `).join('');
        const dotsHtml = slides.map((_, i) => `<button class="carousel-dot${i === this.currentSlide ? ' active' : ''}" data-slide="${i}"></button>`).join('');
        const canPrev = loop || this.currentSlide > 0;
        const canNext = loop || this.currentSlide < slides.length - 1;
        this.setContent(`
      <div class="carousel-container">
        <div class="carousel-track" style="transform:translateX(-${this.currentSlide * 100}%)">
          ${slidesHtml}
        </div>
        <div class="carousel-nav">
          <button class="carousel-btn" data-dir="prev" ${!canPrev ? 'disabled' : ''}>\u2190 Prev</button>
          <div class="carousel-dots">${dotsHtml}</div>
          <button class="carousel-btn" data-dir="next" ${!canNext ? 'disabled' : ''}>Next \u2192</button>
        </div>
      </div>
    `);
        this.shadowRoot?.querySelector('[data-dir="prev"]')?.addEventListener('click', () => this.navigate(-1, slides.length, loop));
        this.shadowRoot?.querySelector('[data-dir="next"]')?.addEventListener('click', () => this.navigate(1, slides.length, loop));
        this.shadowRoot?.querySelectorAll('.carousel-dot').forEach(dot => {
            dot.addEventListener('click', (e) => {
                this.currentSlide = parseInt(e.currentTarget.getAttribute('data-slide') || '0', 10);
                this.render();
            });
        });
    }
    navigate(dir, total, loop) {
        let next = this.currentSlide + dir;
        if (loop) {
            next = (next + total) % total;
        }
        else {
            next = Math.max(0, Math.min(total - 1, next));
        }
        this.currentSlide = next;
        this.render();
        this.emitAction('carousel-navigate', {
            value: this.currentSlide,
            label: `Slide ${this.currentSlide + 1} of ${total}`,
        });
    }
    normalizeSlide(slide) {
        if (typeof slide === 'string') {
            return { content: slide };
        }
        if (!slide || typeof slide !== 'object') {
            return { content: String(slide ?? '') };
        }
        return {
            title: slide.title ?? slide.label ?? slide.name ?? undefined,
            content: String(slide.content ?? slide.body ?? slide.text ?? slide.description ?? ''),
            image: slide.image ?? slide.img ?? slide.src ?? undefined,
        };
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    escapeAttr(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const CAROUSEL_REGISTRATION = {
    schema: {
        slides: { type: 'array' },
        items: { type: 'array' },
        cards: { type: 'array' },
        pages: { type: 'array' },
        loop: { type: 'boolean', default: false },
    },
    category: 'block',
    skeleton: {
        html: '<div style="height:200px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '200px',
    },
};

const FILE_PREVIEW_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .fp-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    overflow: hidden;
  }
  .fp-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
  }
  .fp-icon { font-size: 24px; }
  .fp-info { flex: 1; }
  .fp-filename {
    font-weight: 600;
    font-size: 14px;
    word-break: break-all;
  }
  .fp-meta {
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
  }
  .fp-download {
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid var(--livellm-border, #e0e0e0);
    background: var(--livellm-bg-component, #ffffff);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    color: var(--livellm-primary, #6c5ce7);
    text-decoration: none;
    transition: var(--livellm-transition, 0.2s ease);
  }
  .fp-download:hover { background: rgba(108, 92, 231, 0.04); }
  .fp-preview {
    padding: 16px;
    max-height: 300px;
    overflow: auto;
  }
  .fp-code {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
    background: var(--livellm-bg-secondary, #f8f9fa);
    padding: 12px;
    border-radius: 6px;
  }
  .fp-image {
    max-width: 100%;
    display: block;
  }
`;
const FILE_ICONS = {
    pdf: '\uD83D\uDCC4', doc: '\uD83D\uDCC4', docx: '\uD83D\uDCC4',
    xls: '\uD83D\uDCCA', xlsx: '\uD83D\uDCCA', csv: '\uD83D\uDCCA',
    ppt: '\uD83D\uDCCA', pptx: '\uD83D\uDCCA',
    jpg: '\uD83D\uDDBC\uFE0F', jpeg: '\uD83D\uDDBC\uFE0F', png: '\uD83D\uDDBC\uFE0F', gif: '\uD83D\uDDBC\uFE0F', svg: '\uD83D\uDDBC\uFE0F',
    mp3: '\uD83C\uDFB5', wav: '\uD83C\uDFB5', ogg: '\uD83C\uDFB5',
    mp4: '\uD83C\uDFA5', webm: '\uD83C\uDFA5', avi: '\uD83C\uDFA5',
    zip: '\uD83D\uDCC1', rar: '\uD83D\uDCC1', tar: '\uD83D\uDCC1', gz: '\uD83D\uDCC1',
    js: '\uD83D\uDCDD', ts: '\uD83D\uDCDD', py: '\uD83D\uDCDD', rb: '\uD83D\uDCDD', go: '\uD83D\uDCDD',
    json: '\uD83D\uDCDD', yaml: '\uD83D\uDCDD', yml: '\uD83D\uDCDD', xml: '\uD83D\uDCDD',
    html: '\uD83C\uDF10', css: '\uD83C\uDF10',
    md: '\uD83D\uDCDD', txt: '\uD83D\uDCDD',
};
class LiveLLMFilePreview extends LiveLLMComponent {
    render() {
        const filename = this._props.filename || 'file';
        const url = this._props.url || '';
        const size = this._props.size || '';
        const content = this._props.content || '';
        const language = this._props.language || '';
        this.setStyles(FILE_PREVIEW_STYLES);
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const icon = FILE_ICONS[ext] || '\uD83D\uDCC4';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext);
        let previewHtml = '';
        if (content) {
            previewHtml = `<div class="fp-preview"><pre class="fp-code">${this.escapeHtml(content)}</pre></div>`;
        }
        else if (isImage && url) {
            previewHtml = `<div class="fp-preview"><img class="fp-image" src="${this.escapeAttr(url)}" alt="${this.escapeAttr(filename)}" loading="lazy" /></div>`;
        }
        const metaParts = [ext.toUpperCase()];
        if (size)
            metaParts.push(size);
        if (language)
            metaParts.push(language);
        this.setContent(`
      <div class="fp-container">
        <div class="fp-header">
          <span class="fp-icon">${icon}</span>
          <div class="fp-info">
            <div class="fp-filename">${this.escapeHtml(filename)}</div>
            <div class="fp-meta">${metaParts.join(' \u2022 ')}</div>
          </div>
          ${url ? `<a class="fp-download" href="${this.escapeAttr(url)}" target="_blank" rel="noopener">Download</a>` : ''}
        </div>
        ${previewHtml}
      </div>
    `);
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    escapeAttr(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const FILE_PREVIEW_REGISTRATION = {
    schema: {
        filename: { type: 'string', required: true },
        url: { type: 'string', default: '' },
        size: { type: 'string', default: '' },
        content: { type: 'string', default: '' },
        language: { type: 'string', default: '' },
    },
    category: 'block',
    skeleton: {
        html: '<div style="height:80px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '80px',
    },
};

const CALENDAR_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .cal-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    overflow: hidden;
  }
  .cal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
  }
  .cal-title { font-weight: 700; font-size: 15px; }
  .cal-nav-btn {
    padding: 4px 10px;
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: 4px;
    background: var(--livellm-bg-component, #ffffff);
    cursor: pointer;
    font-size: 14px;
  }
  .cal-nav-btn:hover { background: var(--livellm-bg-secondary, #f8f9fa); }
  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    background: var(--livellm-border, #e0e0e0);
  }
  .cal-day-header {
    text-align: center;
    padding: 8px 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--livellm-text-secondary, #6c757d);
    background: var(--livellm-bg-secondary, #f8f9fa);
    text-transform: uppercase;
  }
  .cal-cell {
    background: var(--livellm-bg-component, #ffffff);
    min-height: 40px;
    padding: 4px 6px;
    font-size: 13px;
    position: relative;
  }
  .cal-cell.other-month { color: var(--livellm-border, #e0e0e0); }
  .cal-cell.today {
    font-weight: 700;
    color: var(--livellm-primary, #6c5ce7);
  }
  .cal-cell.has-event::after {
    content: '';
    position: absolute;
    bottom: 3px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--livellm-primary, #6c5ce7);
  }
  .cal-events {
    padding: 12px 16px;
    border-top: 1px solid var(--livellm-border, #e0e0e0);
  }
  .cal-event {
    display: flex;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
  }
  .cal-event:last-child { border-bottom: none; }
  .cal-event-time {
    font-size: 12px;
    font-weight: 600;
    color: var(--livellm-primary, #6c5ce7);
    min-width: 50px;
  }
  .cal-event-title { font-size: 13px; }
`;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
class LiveLLMCalendar extends LiveLLMComponent {
    constructor() {
        super(...arguments);
        this.viewYear = 0;
        this.viewMonth = 0;
    }
    render() {
        const events = this._props.events || [];
        const initialDate = this._props.date ? new Date(this._props.date) : new Date();
        if (this.viewYear === 0) {
            this.viewYear = initialDate.getFullYear();
            this.viewMonth = initialDate.getMonth();
        }
        this.setStyles(CALENDAR_STYLES);
        const today = new Date();
        const firstDay = new Date(this.viewYear, this.viewMonth, 1);
        const lastDay = new Date(this.viewYear, this.viewMonth + 1, 0);
        const startOffset = firstDay.getDay();
        const eventDates = new Set(events.map(e => {
            const d = new Date(e.date);
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        }));
        // Day headers
        const dayHeaders = DAYS.map(d => `<div class="cal-day-header">${d}</div>`).join('');
        // Calendar cells
        const cells = [];
        // Previous month days
        const prevMonth = new Date(this.viewYear, this.viewMonth, 0);
        for (let i = startOffset - 1; i >= 0; i--) {
            cells.push(`<div class="cal-cell other-month">${prevMonth.getDate() - i}</div>`);
        }
        // Current month days
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const key = `${this.viewYear}-${this.viewMonth}-${d}`;
            const isToday = today.getFullYear() === this.viewYear && today.getMonth() === this.viewMonth && today.getDate() === d;
            const hasEvent = eventDates.has(key);
            const classes = ['cal-cell'];
            if (isToday)
                classes.push('today');
            if (hasEvent)
                classes.push('has-event');
            cells.push(`<div class="${classes.join(' ')}">${d}</div>`);
        }
        // Next month days
        const remaining = 42 - cells.length;
        for (let d = 1; d <= remaining; d++) {
            cells.push(`<div class="cal-cell other-month">${d}</div>`);
        }
        // Events list for this month
        const monthEvents = events.filter(e => {
            const d = new Date(e.date);
            return d.getFullYear() === this.viewYear && d.getMonth() === this.viewMonth;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const eventsListHtml = monthEvents.length > 0 ? `
      <div class="cal-events">
        ${monthEvents.map(e => `
          <div class="cal-event">
            <span class="cal-event-time">${e.time || new Date(e.date).getDate() + ''}</span>
            <span class="cal-event-title">${this.escapeHtml(e.title)}</span>
          </div>
        `).join('')}
      </div>
    ` : '';
        this.setContent(`
      <div class="cal-container">
        <div class="cal-header">
          <button class="cal-nav-btn" data-dir="prev">\u2190</button>
          <span class="cal-title">${MONTHS[this.viewMonth]} ${this.viewYear}</span>
          <button class="cal-nav-btn" data-dir="next">\u2192</button>
        </div>
        <div class="cal-grid">
          ${dayHeaders}
          ${cells.join('')}
        </div>
        ${eventsListHtml}
      </div>
    `);
        this.shadowRoot?.querySelector('[data-dir="prev"]')?.addEventListener('click', () => {
            this.viewMonth--;
            if (this.viewMonth < 0) {
                this.viewMonth = 11;
                this.viewYear--;
            }
            this.render();
        });
        this.shadowRoot?.querySelector('[data-dir="next"]')?.addEventListener('click', () => {
            this.viewMonth++;
            if (this.viewMonth > 11) {
                this.viewMonth = 0;
                this.viewYear++;
            }
            this.render();
        });
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const CALENDAR_REGISTRATION = {
    schema: {
        date: { type: 'string', default: '' },
        events: { type: 'array', default: [] },
    },
    category: 'block',
    skeleton: {
        html: '<div style="height:320px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '320px',
    },
};

const LINK_PREVIEW_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .lp-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    overflow: hidden;
    display: flex;
    cursor: pointer;
    transition: var(--livellm-transition, 0.2s ease);
    text-decoration: none;
    color: inherit;
  }
  .lp-container:hover {
    border-color: var(--livellm-primary, #6c5ce7);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  .lp-image {
    width: 120px;
    min-height: 90px;
    background: var(--livellm-bg-secondary, #f8f9fa);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    overflow: hidden;
  }
  .lp-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .lp-content {
    padding: 12px 16px;
    flex: 1;
    min-width: 0;
  }
  .lp-title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lp-description {
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 6px;
  }
  .lp-domain {
    font-size: 11px;
    color: var(--livellm-text-secondary, #6c757d);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .lp-domain-icon {
    width: 14px;
    height: 14px;
  }
`;
const DOMAIN_ICONS = {
    'github.com': '\uD83D\uDC19',
    'stackoverflow.com': '\uD83D\uDCDA',
    'youtube.com': '\u25B6\uFE0F',
    'youtu.be': '\u25B6\uFE0F',
    'twitter.com': '\uD83D\uDC26',
    'x.com': '\uD83D\uDC26',
    'reddit.com': '\uD83E\uDD16',
    'wikipedia.org': '\uD83D\uDCDA',
    'medium.com': '\u270D\uFE0F',
    'dev.to': '\uD83D\uDC68\u200D\uD83D\uDCBB',
    'npmjs.com': '\uD83D\uDCE6',
};
class LiveLLMLinkPreview extends LiveLLMComponent {
    render() {
        const url = this._props.url || '';
        const title = this._props.title || url;
        const description = this._props.description || '';
        const image = this._props.image || '';
        const domain = this._props.domain || this.getDomain(url);
        this.setStyles(LINK_PREVIEW_STYLES);
        const icon = DOMAIN_ICONS[domain] || '\uD83C\uDF10';
        const imageHtml = image
            ? `<img src="${this.escapeAttr(image)}" alt="" loading="lazy" />`
            : icon;
        this.setContent(`
      <a class="lp-container" href="${this.escapeAttr(url)}" target="_blank" rel="noopener noreferrer">
        <div class="lp-image">${imageHtml}</div>
        <div class="lp-content">
          <div class="lp-title">${this.escapeHtml(title)}</div>
          ${description ? `<div class="lp-description">${this.escapeHtml(description)}</div>` : ''}
          <div class="lp-domain"><span class="lp-domain-icon">${icon}</span>${this.escapeHtml(domain)}</div>
        </div>
      </a>
    `);
    }
    getDomain(url) {
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        }
        catch {
            return url;
        }
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    escapeAttr(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const LINK_PREVIEW_REGISTRATION = {
    schema: {
        url: { type: 'string', required: true },
        title: { type: 'string', default: '' },
        description: { type: 'string', default: '' },
        image: { type: 'string', default: '' },
        domain: { type: 'string', default: '' },
    },
    category: 'block',
    skeleton: {
        html: '<div style="height:90px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '90px',
    },
};

const CODE_RUNNER_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .cr-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    overflow: hidden;
  }
  .cr-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
  }
  .cr-lang {
    font-size: 12px;
    font-weight: 600;
    color: var(--livellm-text-secondary, #6c757d);
    text-transform: uppercase;
  }
  .cr-actions {
    display: flex;
    gap: 6px;
  }
  .cr-btn {
    padding: 4px 10px;
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: 4px;
    background: var(--livellm-bg-component, #ffffff);
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
    transition: var(--livellm-transition, 0.2s ease);
  }
  .cr-btn:hover {
    border-color: var(--livellm-primary, #6c5ce7);
    color: var(--livellm-primary, #6c5ce7);
  }
  .cr-btn.run {
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
    border-color: var(--livellm-primary, #6c5ce7);
  }
  .cr-btn.run:hover { opacity: 0.9; }
  .cr-btn.copied {
    background: var(--livellm-success, #00b894);
    color: #fff;
    border-color: var(--livellm-success, #00b894);
  }
  .cr-code {
    padding: 14px 16px;
    margin: 0;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Fira Code', monospace;
    font-size: 13px;
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre;
    background: #1e1e2e;
    color: #cdd6f4;
    counter-reset: line;
  }
  .cr-code.show-lines {
    padding-left: 50px;
    position: relative;
  }
  .cr-line {
    display: block;
  }
  .cr-code.show-lines .cr-line::before {
    counter-increment: line;
    content: counter(line);
    position: absolute;
    left: 14px;
    width: 24px;
    text-align: right;
    color: #585b70;
    font-size: 12px;
  }
  .cr-output {
    border-top: 1px solid var(--livellm-border, #e0e0e0);
    padding: 12px 16px;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 13px;
    line-height: 1.5;
    background: var(--livellm-bg-secondary, #f8f9fa);
    white-space: pre-wrap;
    max-height: 200px;
    overflow: auto;
  }
  .cr-output-header {
    font-size: 11px;
    font-weight: 600;
    color: var(--livellm-text-secondary, #6c757d);
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .cr-output-error { color: #e74c3c; }
`;
class LiveLLMCodeRunner extends LiveLLMComponent {
    constructor() {
        super(...arguments);
        this.output = '';
        this.hasError = false;
    }
    render() {
        const code = this._props.code || '';
        const language = this._props.language || '';
        const showLineNumbers = this._props.showLineNumbers ?? true;
        const copyable = this._props.copyable ?? true;
        const runnable = this._props.runnable ?? false;
        this.setStyles(CODE_RUNNER_STYLES);
        const lines = code.split('\n').map(l => `<span class="cr-line">${this.escapeHtml(l)}</span>`).join('\n');
        const outputHtml = this.output ? `
      <div class="cr-output">
        <div class="cr-output-header">Output</div>
        <div class="${this.hasError ? 'cr-output-error' : ''}">${this.escapeHtml(this.output)}</div>
      </div>
    ` : '';
        this.setContent(`
      <div class="cr-container">
        <div class="cr-header">
          <span class="cr-lang">${this.escapeHtml(language)}</span>
          <div class="cr-actions">
            ${copyable ? '<button class="cr-btn copy">\uD83D\uDCCB Copy</button>' : ''}
            ${runnable ? '<button class="cr-btn run">\u25B6 Run</button>' : ''}
          </div>
        </div>
        <pre class="cr-code${showLineNumbers ? ' show-lines' : ''}">${lines}</pre>
        ${outputHtml}
      </div>
    `);
        if (copyable) {
            this.shadowRoot?.querySelector('.cr-btn.copy')?.addEventListener('click', (e) => {
                this.copyCode(code, e.currentTarget);
            });
        }
        if (runnable) {
            this.shadowRoot?.querySelector('.cr-btn.run')?.addEventListener('click', () => {
                this.runCode(code, language);
            });
        }
    }
    copyCode(code, btn) {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(code);
            }
            btn.textContent = '\u2713 Copied';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = '\uD83D\uDCCB Copy';
                btn.classList.remove('copied');
            }, 2000);
        }
        catch { }
        this.emitAction('code-copy', {
            value: code,
            label: 'Copied code to clipboard',
        });
    }
    runCode(code, language) {
        if (['javascript', 'js'].includes(language.toLowerCase())) {
            try {
                const logs = [];
                const mockConsole = {
                    log: (...args) => logs.push(args.map(String).join(' ')),
                    error: (...args) => logs.push('Error: ' + args.map(String).join(' ')),
                    warn: (...args) => logs.push('Warning: ' + args.map(String).join(' ')),
                };
                const fn = new Function('console', code);
                const result = fn(mockConsole);
                if (result !== undefined)
                    logs.push(String(result));
                this.output = logs.join('\n') || 'No output';
                this.hasError = false;
            }
            catch (e) {
                this.output = e.message || String(e);
                this.hasError = true;
            }
            this.render();
        }
        this.emitAction('code-run', {
            value: code,
            label: `Ran ${language} code`,
            language,
        });
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const CODE_RUNNER_REGISTRATION = {
    schema: {
        code: { type: 'string', required: true },
        language: { type: 'string', default: '' },
        showLineNumbers: { type: 'boolean', default: true },
        copyable: { type: 'boolean', default: true },
        runnable: { type: 'boolean', default: false },
    },
    category: 'block',
    skeleton: {
        html: '<div style="height:150px;border-radius:8px;background:#1e1e2e;"></div>',
        height: '150px',
    },
};

const CHOICE_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .choice-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .choice-question {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 12px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .choice-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .choice-option {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    border: 2px solid var(--livellm-border, #e0e0e0);
    border-radius: 6px;
    cursor: pointer;
    transition: var(--livellm-transition, 0.2s ease);
    background: var(--livellm-bg, #ffffff);
    font-family: inherit;
    font-size: 14px;
    color: inherit;
    text-align: left;
    width: 100%;
    box-sizing: border-box;
  }
  .choice-option:hover {
    border-color: var(--livellm-primary, #6c5ce7);
    background: rgba(108, 92, 231, 0.04);
  }
  .choice-option.selected {
    border-color: var(--livellm-primary, #6c5ce7);
    background: rgba(108, 92, 231, 0.08);
    font-weight: 500;
  }
  .choice-option.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }
  .choice-radio {
    width: 18px;
    height: 18px;
    border: 2px solid var(--livellm-border, #e0e0e0);
    border-radius: 50%;
    margin-right: 10px;
    flex-shrink: 0;
    position: relative;
    transition: var(--livellm-transition, 0.2s ease);
  }
  .choice-option.selected .choice-radio {
    border-color: var(--livellm-primary, #6c5ce7);
  }
  .choice-option.selected .choice-radio::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 8px;
    height: 8px;
    background: var(--livellm-primary, #6c5ce7);
    border-radius: 50%;
  }
  .choice-label { flex: 1; }
  .choice-description {
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
    margin-top: 2px;
  }
`;
class LiveLLMChoice extends LiveLLMComponent {
    constructor() {
        super(...arguments);
        this.selectedIndex = -1;
        this.submitted = false;
    }
    normalizeOption(opt) {
        if (!opt)
            return { label: '', value: '' };
        if (typeof opt === 'string') {
            return { label: opt, value: opt };
        }
        return {
            label: String(opt.label || opt.value || ''),
            value: String(opt.value || opt.label || ''),
            description: opt.description ? String(opt.description) : undefined,
        };
    }
    render() {
        const question = this._props.question || '';
        const rawOptions = this._props.options || this._props.choices || this._props.items || [];
        const options = rawOptions.map(o => this.normalizeOption(o));
        this.setStyles(CHOICE_STYLES);
        const optionsHtml = options
            .map((opt, i) => `
        <button class="choice-option${i === this.selectedIndex ? ' selected' : ''}${this.submitted ? ' disabled' : ''}" data-index="${i}">
          <div class="choice-radio"></div>
          <div>
            <div class="choice-label">${this.escapeHtml(opt.label)}</div>
            ${opt.description ? `<div class="choice-description">${this.escapeHtml(opt.description)}</div>` : ''}
          </div>
        </button>`)
            .join('');
        this.setContent(`
      <div class="choice-container">
        ${question ? `<div class="choice-question">${this.escapeHtml(question)}</div>` : ''}
        <div class="choice-options">${optionsHtml}</div>
      </div>
    `);
        if (!this.submitted) {
            this.shadowRoot?.querySelectorAll('.choice-option').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const target = e.currentTarget;
                    const index = parseInt(target.getAttribute('data-index') || '0', 10);
                    this.selectOption(index);
                });
            });
        }
    }
    selectOption(index) {
        if (this.submitted)
            return;
        const rawOptions = this._props.options || this._props.choices || this._props.items || [];
        const options = rawOptions.map(o => this.normalizeOption(o));
        const option = options[index];
        if (!option)
            return;
        this.selectedIndex = index;
        this.submitted = true;
        this.render();
        this.emitAction('choice-select', {
            value: option.value || option.label,
            label: `Selected: ${option.label}`,
            index,
            option,
        });
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const CHOICE_REGISTRATION = {
    schema: {
        question: { type: 'string', default: '' },
        options: { type: 'array' },
        choices: { type: 'array' },
        items: { type: 'array' },
    },
    category: 'action',
    skeleton: {
        html: '<div style="height:120px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '120px',
    },
};

const CONFIRM_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .confirm-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    text-align: center;
  }
  .confirm-text {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 14px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .confirm-buttons {
    display: flex;
    gap: 10px;
    justify-content: center;
  }
  .confirm-btn {
    padding: 8px 24px;
    border-radius: 6px;
    border: 2px solid transparent;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    transition: var(--livellm-transition, 0.2s ease);
    min-width: 100px;
  }
  .confirm-btn.primary {
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
    border-color: var(--livellm-primary, #6c5ce7);
  }
  .confirm-btn.primary:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  .confirm-btn.secondary {
    background: transparent;
    color: var(--livellm-text-secondary, #6c757d);
    border-color: var(--livellm-border, #e0e0e0);
  }
  .confirm-btn.secondary:hover {
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-color: var(--livellm-text-secondary, #6c757d);
  }
  .confirm-btn.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }
  .confirm-result {
    margin-top: 10px;
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    font-style: italic;
  }
`;
class LiveLLMConfirm extends LiveLLMComponent {
    constructor() {
        super(...arguments);
        this.answered = false;
        this.answer = null;
    }
    render() {
        const text = this._props.text || 'Are you sure?';
        const confirmLabel = this._props.confirmLabel || 'Yes';
        const cancelLabel = this._props.cancelLabel || 'No';
        this.setStyles(CONFIRM_STYLES);
        let resultHtml = '';
        if (this.answered) {
            const label = this.answer ? confirmLabel : cancelLabel;
            resultHtml = `<div class="confirm-result">You selected: ${this.escapeHtml(label)}</div>`;
        }
        this.setContent(`
      <div class="confirm-container">
        <div class="confirm-text">${this.escapeHtml(text)}</div>
        <div class="confirm-buttons">
          <button class="confirm-btn primary${this.answered ? ' disabled' : ''}" data-action="confirm">${this.escapeHtml(confirmLabel)}</button>
          <button class="confirm-btn secondary${this.answered ? ' disabled' : ''}" data-action="cancel">${this.escapeHtml(cancelLabel)}</button>
        </div>
        ${resultHtml}
      </div>
    `);
        if (!this.answered) {
            this.shadowRoot?.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
                this.handleAction(true);
            });
            this.shadowRoot?.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
                this.handleAction(false);
            });
        }
    }
    handleAction(confirmed) {
        if (this.answered)
            return;
        this.answered = true;
        this.answer = confirmed;
        this.render();
        const label = confirmed
            ? (this._props.confirmLabel || 'Yes')
            : (this._props.cancelLabel || 'No');
        this.emitAction('confirm-response', {
            value: confirmed,
            label: `${confirmed ? 'Confirmed' : 'Declined'}: ${label}`,
            confirmed,
        });
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const CONFIRM_REGISTRATION = {
    schema: {
        text: { type: 'string', default: 'Are you sure?' },
        confirmLabel: { type: 'string', default: 'Yes' },
        cancelLabel: { type: 'string', default: 'No' },
    },
    category: 'action',
    skeleton: {
        html: '<div style="height:90px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '90px',
    },
};

const MULTI_CHOICE_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .mc-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .mc-question {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 4px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .mc-hint {
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
    margin-bottom: 12px;
  }
  .mc-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mc-option {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    border: 2px solid var(--livellm-border, #e0e0e0);
    border-radius: 6px;
    cursor: pointer;
    transition: var(--livellm-transition, 0.2s ease);
    background: var(--livellm-bg, #ffffff);
    font-family: inherit;
    font-size: 14px;
    color: inherit;
    text-align: left;
    width: 100%;
    box-sizing: border-box;
  }
  .mc-option:hover {
    border-color: var(--livellm-primary, #6c5ce7);
    background: rgba(108, 92, 231, 0.04);
  }
  .mc-option.selected {
    border-color: var(--livellm-primary, #6c5ce7);
    background: rgba(108, 92, 231, 0.08);
  }
  .mc-option.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }
  .mc-checkbox {
    width: 18px;
    height: 18px;
    border: 2px solid var(--livellm-border, #e0e0e0);
    border-radius: 4px;
    margin-right: 10px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--livellm-transition, 0.2s ease);
  }
  .mc-option.selected .mc-checkbox {
    border-color: var(--livellm-primary, #6c5ce7);
    background: var(--livellm-primary, #6c5ce7);
  }
  .mc-checkbox-check {
    display: none;
    color: #fff;
    font-size: 12px;
    font-weight: bold;
  }
  .mc-option.selected .mc-checkbox-check { display: block; }
  .mc-label { flex: 1; }
  .mc-submit {
    margin-top: 12px;
    padding: 8px 24px;
    border-radius: 6px;
    border: none;
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    transition: var(--livellm-transition, 0.2s ease);
  }
  .mc-submit:hover { opacity: 0.9; }
  .mc-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
class LiveLLMMultiChoice extends LiveLLMComponent {
    constructor() {
        super(...arguments);
        this.selectedIndices = new Set();
        this.submitted = false;
    }
    normalizeOption(opt) {
        if (typeof opt === 'string') {
            return { label: opt, value: opt };
        }
        return {
            label: opt.label || opt.value || '',
            value: opt.value || opt.label || '',
        };
    }
    render() {
        const question = this._props.question || '';
        const rawOptions = this._props.options || this._props.choices || this._props.items || [];
        const options = rawOptions.map(o => this.normalizeOption(o));
        const min = this._props.min ?? 1;
        const max = this._props.max ?? options.length;
        this.setStyles(MULTI_CHOICE_STYLES);
        const optionsHtml = options
            .map((opt, i) => `
        <button class="mc-option${this.selectedIndices.has(i) ? ' selected' : ''}${this.submitted ? ' disabled' : ''}" data-index="${i}">
          <div class="mc-checkbox"><span class="mc-checkbox-check">\u2713</span></div>
          <div class="mc-label">${this.escapeHtml(opt.label)}</div>
        </button>`)
            .join('');
        const canSubmit = this.selectedIndices.size >= min && this.selectedIndices.size <= max;
        this.setContent(`
      <div class="mc-container">
        ${question ? `<div class="mc-question">${this.escapeHtml(question)}</div>` : ''}
        <div class="mc-hint">Select ${min === max ? min : `${min}-${max}`} option${max > 1 ? 's' : ''}</div>
        <div class="mc-options">${optionsHtml}</div>
        ${!this.submitted ? `<button class="mc-submit"${!canSubmit ? ' disabled' : ''}>Submit</button>` : ''}
      </div>
    `);
        if (!this.submitted) {
            this.shadowRoot?.querySelectorAll('.mc-option').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const target = e.currentTarget;
                    const index = parseInt(target.getAttribute('data-index') || '0', 10);
                    this.toggleOption(index, max);
                });
            });
            this.shadowRoot?.querySelector('.mc-submit')?.addEventListener('click', () => {
                this.submitSelection();
            });
        }
    }
    toggleOption(index, max) {
        if (this.submitted)
            return;
        if (this.selectedIndices.has(index)) {
            this.selectedIndices.delete(index);
        }
        else if (this.selectedIndices.size < max) {
            this.selectedIndices.add(index);
        }
        this.render();
    }
    submitSelection() {
        if (this.submitted)
            return;
        const rawOptions = this._props.options || this._props.choices || this._props.items || [];
        const options = rawOptions.map(o => this.normalizeOption(o));
        const selected = Array.from(this.selectedIndices)
            .sort()
            .map((i) => options[i])
            .filter(Boolean);
        this.submitted = true;
        this.render();
        this.emitAction('multi-choice-submit', {
            value: selected.map((o) => o.value || o.label),
            label: `Selected: ${selected.map((o) => o.label).join(', ')}`,
            selected,
            indices: Array.from(this.selectedIndices).sort(),
        });
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const MULTI_CHOICE_REGISTRATION = {
    schema: {
        question: { type: 'string', default: '' },
        options: { type: 'array' },
        choices: { type: 'array' },
        items: { type: 'array' },
        min: { type: 'number', default: 1, min: 0 },
        max: { type: 'number', default: 10, min: 1 },
    },
    category: 'action',
    skeleton: {
        html: '<div style="height:140px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '140px',
    },
};

const RATING_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .rating-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    text-align: center;
  }
  .rating-label {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 12px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .rating-stars {
    display: inline-flex;
    gap: 4px;
    margin-bottom: 8px;
  }
  .rating-star {
    width: 32px;
    height: 32px;
    cursor: pointer;
    border: none;
    background: transparent;
    padding: 0;
    transition: transform 0.15s ease;
    font-size: 28px;
    line-height: 1;
  }
  .rating-star:hover { transform: scale(1.2); }
  .rating-star.disabled {
    cursor: not-allowed;
    pointer-events: none;
  }
  .rating-star .star-filled { color: #f9ca24; }
  .rating-star .star-empty { color: var(--livellm-border, #e0e0e0); }
  .rating-value {
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    margin-top: 4px;
  }
  .rating-labels {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--livellm-text-secondary, #6c757d);
    margin-top: 4px;
  }
`;
class LiveLLMRatingInput extends LiveLLMComponent {
    constructor() {
        super(...arguments);
        this.rating = 0;
        this.hoveredRating = 0;
        this.submitted = false;
    }
    render() {
        const label = this._props.label || 'Rate this response';
        const max = this._props.max ?? 5;
        const lowLabel = this._props.lowLabel || '';
        const highLabel = this._props.highLabel || '';
        this.setStyles(RATING_STYLES);
        const stars = Array.from({ length: max }, (_, i) => {
            const filled = i < (this.hoveredRating || this.rating);
            return `<button class="rating-star${this.submitted ? ' disabled' : ''}" data-value="${i + 1}">
        <span class="${filled ? 'star-filled' : 'star-empty'}">\u2605</span>
      </button>`;
        }).join('');
        const valueText = this.rating > 0 ? `${this.rating} / ${max}` : '';
        this.setContent(`
      <div class="rating-container">
        <div class="rating-label">${this.escapeHtml(label)}</div>
        <div class="rating-stars">${stars}</div>
        ${valueText ? `<div class="rating-value">${valueText}</div>` : ''}
        ${lowLabel || highLabel ? `<div class="rating-labels"><span>${this.escapeHtml(lowLabel)}</span><span>${this.escapeHtml(highLabel)}</span></div>` : ''}
      </div>
    `);
        if (!this.submitted) {
            this.shadowRoot?.querySelectorAll('.rating-star').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const val = parseInt(e.currentTarget.getAttribute('data-value') || '0', 10);
                    this.setRating(val);
                });
                btn.addEventListener('mouseenter', (e) => {
                    this.hoveredRating = parseInt(e.currentTarget.getAttribute('data-value') || '0', 10);
                    this.render();
                });
                btn.addEventListener('mouseleave', () => {
                    this.hoveredRating = 0;
                    this.render();
                });
            });
        }
    }
    setRating(value) {
        if (this.submitted)
            return;
        this.rating = value;
        this.submitted = true;
        this.hoveredRating = 0;
        this.render();
        this.emitAction('rating-submit', {
            value,
            label: `Rated: ${value} / ${this._props.max ?? 5}`,
            max: this._props.max ?? 5,
        });
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const RATING_INPUT_REGISTRATION = {
    schema: {
        label: { type: 'string', default: 'Rate this response' },
        max: { type: 'number', default: 5, min: 1, max: 10 },
        lowLabel: { type: 'string', default: '' },
        highLabel: { type: 'string', default: '' },
    },
    category: 'action',
    skeleton: {
        html: '<div style="height:80px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '80px',
    },
};

const DATE_PICKER_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .dp-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .dp-label {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 10px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .dp-input-row {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .dp-input {
    flex: 1;
    padding: 8px 12px;
    border: 2px solid var(--livellm-border, #e0e0e0);
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    color: var(--livellm-text, #1a1a1a);
    background: var(--livellm-bg, #ffffff);
    transition: var(--livellm-transition, 0.2s ease);
  }
  .dp-input:focus {
    outline: none;
    border-color: var(--livellm-primary, #6c5ce7);
  }
  .dp-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .dp-submit {
    padding: 8px 20px;
    border-radius: 6px;
    border: none;
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    transition: var(--livellm-transition, 0.2s ease);
    white-space: nowrap;
  }
  .dp-submit:hover { opacity: 0.9; }
  .dp-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .dp-result {
    margin-top: 8px;
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    font-style: italic;
  }
`;
class LiveLLMDatePicker extends LiveLLMComponent {
    constructor() {
        super(...arguments);
        this.selectedDate = '';
        this.submitted = false;
    }
    render() {
        const label = this._props.label || 'Select a date';
        const min = this._props.min || '';
        const max = this._props.max || '';
        const includeTime = this._props.includeTime ?? false;
        const inputType = includeTime ? 'datetime-local' : 'date';
        this.setStyles(DATE_PICKER_STYLES);
        const resultHtml = this.submitted && this.selectedDate
            ? `<div class="dp-result">Selected: ${this.escapeHtml(this.formatDate(this.selectedDate, includeTime))}</div>`
            : '';
        this.setContent(`
      <div class="dp-container">
        <div class="dp-label">${this.escapeHtml(label)}</div>
        <div class="dp-input-row">
          <input type="${inputType}" class="dp-input"
            ${min ? `min="${this.escapeHtml(min)}"` : ''}
            ${max ? `max="${this.escapeHtml(max)}"` : ''}
            ${this.selectedDate ? `value="${this.escapeHtml(this.selectedDate)}"` : ''}
            ${this.submitted ? 'disabled' : ''}
          />
          <button class="dp-submit"${this.submitted ? ' disabled' : ''}>Submit</button>
        </div>
        ${resultHtml}
      </div>
    `);
        if (!this.submitted) {
            const input = this.shadowRoot?.querySelector('.dp-input');
            const btn = this.shadowRoot?.querySelector('.dp-submit');
            input?.addEventListener('change', (e) => {
                this.selectedDate = e.target.value;
            });
            btn?.addEventListener('click', () => {
                if (this.selectedDate) {
                    this.submitDate();
                }
            });
        }
    }
    submitDate() {
        if (this.submitted || !this.selectedDate)
            return;
        this.submitted = true;
        this.render();
        const includeTime = this._props.includeTime ?? false;
        this.emitAction('date-select', {
            value: this.selectedDate,
            label: `Selected date: ${this.formatDate(this.selectedDate, includeTime)}`,
            iso: this.selectedDate,
        });
    }
    formatDate(dateStr, includeTime) {
        try {
            const d = new Date(dateStr);
            if (includeTime) {
                return d.toLocaleString();
            }
            return d.toLocaleDateString();
        }
        catch {
            return dateStr;
        }
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const DATE_PICKER_REGISTRATION = {
    schema: {
        label: { type: 'string', default: 'Select a date' },
        min: { type: 'string', default: '' },
        max: { type: 'string', default: '' },
        includeTime: { type: 'boolean', default: false },
    },
    category: 'action',
    skeleton: {
        html: '<div style="height:70px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '70px',
    },
};

const TEXT_INPUT_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .ti-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .ti-label {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 4px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .ti-hint {
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
    margin-bottom: 10px;
  }
  .ti-input-row {
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }
  .ti-input, .ti-textarea {
    flex: 1;
    padding: 8px 12px;
    border: 2px solid var(--livellm-border, #e0e0e0);
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    color: var(--livellm-text, #1a1a1a);
    background: var(--livellm-bg, #ffffff);
    transition: var(--livellm-transition, 0.2s ease);
    resize: vertical;
  }
  .ti-textarea {
    min-height: 60px;
  }
  .ti-input:focus, .ti-textarea:focus {
    outline: none;
    border-color: var(--livellm-primary, #6c5ce7);
  }
  .ti-input:disabled, .ti-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .ti-submit {
    padding: 8px 20px;
    border-radius: 6px;
    border: none;
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    transition: var(--livellm-transition, 0.2s ease);
    white-space: nowrap;
    align-self: flex-end;
  }
  .ti-submit:hover { opacity: 0.9; }
  .ti-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .ti-char-count {
    font-size: 11px;
    color: var(--livellm-text-secondary, #6c757d);
    text-align: right;
    margin-top: 4px;
  }
  .ti-char-count.over { color: #e74c3c; }
  .ti-result {
    margin-top: 8px;
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    font-style: italic;
  }
`;
class LiveLLMTextInput extends LiveLLMComponent {
    constructor() {
        super(...arguments);
        this.text = '';
        this.submitted = false;
    }
    render() {
        const label = this._props.label || 'Enter your response';
        const placeholder = this._props.placeholder || '';
        const hint = this._props.hint || '';
        const multiline = this._props.multiline ?? false;
        const maxLength = this._props.maxLength ?? 0;
        this.setStyles(TEXT_INPUT_STYLES);
        const inputEl = multiline
            ? `<textarea class="ti-textarea" placeholder="${this.escapeAttr(placeholder)}" ${maxLength ? `maxlength="${maxLength}"` : ''} ${this.submitted ? 'disabled' : ''}>${this.escapeHtml(this.text)}</textarea>`
            : `<input type="text" class="ti-input" placeholder="${this.escapeAttr(placeholder)}" value="${this.escapeAttr(this.text)}" ${maxLength ? `maxlength="${maxLength}"` : ''} ${this.submitted ? 'disabled' : ''} />`;
        const charCount = maxLength > 0
            ? `<div class="ti-char-count${this.text.length > maxLength ? ' over' : ''}">${this.text.length}/${maxLength}</div>`
            : '';
        const resultHtml = this.submitted
            ? `<div class="ti-result">Submitted: ${this.escapeHtml(this.text.length > 60 ? this.text.substring(0, 60) + '...' : this.text)}</div>`
            : '';
        this.setContent(`
      <div class="ti-container">
        <div class="ti-label">${this.escapeHtml(label)}</div>
        ${hint ? `<div class="ti-hint">${this.escapeHtml(hint)}</div>` : ''}
        <div class="ti-input-row">
          ${inputEl}
          <button class="ti-submit"${this.submitted ? ' disabled' : ''}>Submit</button>
        </div>
        ${charCount}
        ${resultHtml}
      </div>
    `);
        if (!this.submitted) {
            const inputElement = this.shadowRoot?.querySelector('.ti-input, .ti-textarea');
            const btn = this.shadowRoot?.querySelector('.ti-submit');
            inputElement?.addEventListener('input', (e) => {
                this.text = e.target.value;
                if (maxLength > 0) {
                    const countEl = this.shadowRoot?.querySelector('.ti-char-count');
                    if (countEl) {
                        countEl.textContent = `${this.text.length}/${maxLength}`;
                        countEl.classList.toggle('over', this.text.length > maxLength);
                    }
                }
            });
            // Submit on Enter for single-line input
            if (!multiline) {
                inputElement?.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && this.text.trim()) {
                        this.submitText();
                    }
                });
            }
            btn?.addEventListener('click', () => {
                if (this.text.trim()) {
                    this.submitText();
                }
            });
        }
    }
    submitText() {
        if (this.submitted || !this.text.trim())
            return;
        this.submitted = true;
        this.render();
        this.emitAction('text-submit', {
            value: this.text,
            label: this.text.length > 80 ? this.text.substring(0, 80) + '...' : this.text,
            length: this.text.length,
        });
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    escapeAttr(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const TEXT_INPUT_REGISTRATION = {
    schema: {
        label: { type: 'string', default: 'Enter your response' },
        placeholder: { type: 'string', default: '' },
        hint: { type: 'string', default: '' },
        multiline: { type: 'boolean', default: false },
        maxLength: { type: 'number', default: 0 },
    },
    category: 'action',
    skeleton: {
        html: '<div style="height:70px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '70px',
    },
};

const SLIDER_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .slider-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .slider-label {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 12px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .slider-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .slider-input {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    background: var(--livellm-border, #e0e0e0);
    border-radius: 3px;
    outline: none;
  }
  .slider-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--livellm-primary, #6c5ce7);
    cursor: pointer;
    transition: transform 0.15s ease;
  }
  .slider-input::-webkit-slider-thumb:hover { transform: scale(1.15); }
  .slider-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .slider-input:disabled::-webkit-slider-thumb { cursor: not-allowed; }
  .slider-value {
    min-width: 50px;
    text-align: center;
    font-weight: 600;
    font-size: 16px;
    color: var(--livellm-primary, #6c5ce7);
  }
  .slider-submit {
    padding: 8px 20px;
    border-radius: 6px;
    border: none;
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    transition: var(--livellm-transition, 0.2s ease);
    white-space: nowrap;
  }
  .slider-submit:hover { opacity: 0.9; }
  .slider-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .slider-range {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--livellm-text-secondary, #6c757d);
    margin-top: 4px;
  }
  .slider-result {
    margin-top: 8px;
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    font-style: italic;
  }
`;
class LiveLLMSlider extends LiveLLMComponent {
    constructor() {
        super(...arguments);
        this.value = 0;
        this.submitted = false;
    }
    render() {
        const label = this._props.label || 'Select a value';
        const min = this._props.min ?? 0;
        const max = this._props.max ?? 100;
        const step = this._props.step ?? 1;
        const defaultValue = this._props.defaultValue ?? Math.round((min + max) / 2);
        const suffix = this._props.suffix || '';
        const showRange = this._props.showRange ?? true;
        if (!this.submitted && this.value === 0) {
            this.value = defaultValue;
        }
        this.setStyles(SLIDER_STYLES);
        const resultHtml = this.submitted
            ? `<div class="slider-result">Submitted: ${this.value}${suffix}</div>`
            : '';
        this.setContent(`
      <div class="slider-container">
        <div class="slider-label">${this.escapeHtml(label)}</div>
        <div class="slider-row">
          <input type="range" class="slider-input" min="${min}" max="${max}" step="${step}" value="${this.value}" ${this.submitted ? 'disabled' : ''} />
          <span class="slider-value">${this.value}${this.escapeHtml(suffix)}</span>
          ${!this.submitted ? '<button class="slider-submit">Submit</button>' : ''}
        </div>
        ${showRange ? `<div class="slider-range"><span>${min}${this.escapeHtml(suffix)}</span><span>${max}${this.escapeHtml(suffix)}</span></div>` : ''}
        ${resultHtml}
      </div>
    `);
        if (!this.submitted) {
            const input = this.shadowRoot?.querySelector('.slider-input');
            const valueEl = this.shadowRoot?.querySelector('.slider-value');
            const btn = this.shadowRoot?.querySelector('.slider-submit');
            input?.addEventListener('input', (e) => {
                this.value = parseFloat(e.target.value);
                if (valueEl) {
                    valueEl.textContent = `${this.value}${suffix}`;
                }
            });
            btn?.addEventListener('click', () => {
                this.submitValue();
            });
        }
    }
    submitValue() {
        if (this.submitted)
            return;
        this.submitted = true;
        this.render();
        const suffix = this._props.suffix || '';
        this.emitAction('slider-submit', {
            value: this.value,
            label: `Selected: ${this.value}${suffix}`,
            min: this._props.min ?? 0,
            max: this._props.max ?? 100,
        });
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const SLIDER_REGISTRATION = {
    schema: {
        label: { type: 'string', default: 'Select a value' },
        min: { type: 'number', default: 0 },
        max: { type: 'number', default: 100 },
        step: { type: 'number', default: 1 },
        defaultValue: { type: 'number' },
        suffix: { type: 'string', default: '' },
        showRange: { type: 'boolean', default: true },
    },
    category: 'action',
    skeleton: {
        html: '<div style="height:80px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '80px',
    },
};

const FILE_UPLOAD_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .fu-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .fu-label {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 10px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .fu-dropzone {
    border: 2px dashed var(--livellm-border, #e0e0e0);
    border-radius: 8px;
    padding: 24px;
    text-align: center;
    cursor: pointer;
    transition: var(--livellm-transition, 0.2s ease);
    background: var(--livellm-bg-secondary, #f8f9fa);
  }
  .fu-dropzone:hover, .fu-dropzone.dragover {
    border-color: var(--livellm-primary, #6c5ce7);
    background: rgba(108, 92, 231, 0.04);
  }
  .fu-dropzone.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }
  .fu-icon {
    font-size: 32px;
    margin-bottom: 8px;
    opacity: 0.5;
  }
  .fu-text {
    font-size: 14px;
    color: var(--livellm-text-secondary, #6c757d);
  }
  .fu-text strong { color: var(--livellm-primary, #6c5ce7); }
  .fu-hint {
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
    margin-top: 4px;
  }
  .fu-file-input { display: none; }
  .fu-file-info {
    margin-top: 12px;
    padding: 10px 14px;
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--livellm-bg-secondary, #f8f9fa);
  }
  .fu-file-icon { font-size: 20px; }
  .fu-file-details { flex: 1; }
  .fu-file-name {
    font-weight: 500;
    font-size: 14px;
    word-break: break-all;
  }
  .fu-file-size {
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
  }
  .fu-submit {
    padding: 8px 20px;
    border-radius: 6px;
    border: none;
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    transition: var(--livellm-transition, 0.2s ease);
    margin-top: 10px;
  }
  .fu-submit:hover { opacity: 0.9; }
  .fu-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
class LiveLLMFileUpload extends LiveLLMComponent {
    constructor() {
        super(...arguments);
        this.selectedFile = null;
        this.submitted = false;
    }
    render() {
        const label = this._props.label || 'Upload a file';
        const accept = this._props.accept || '';
        const maxSizeMB = this._props.maxSizeMB ?? 10;
        const multiple = this._props.multiple ?? false;
        this.setStyles(FILE_UPLOAD_STYLES);
        const acceptHint = accept ? `Accepted: ${accept}` : '';
        const sizeHint = `Max size: ${maxSizeMB}MB`;
        let fileInfoHtml = '';
        if (this.selectedFile) {
            fileInfoHtml = `
        <div class="fu-file-info">
          <span class="fu-file-icon">\uD83D\uDCC4</span>
          <div class="fu-file-details">
            <div class="fu-file-name">${this.escapeHtml(this.selectedFile.name)}</div>
            <div class="fu-file-size">${this.formatSize(this.selectedFile.size)}</div>
          </div>
        </div>
        ${!this.submitted ? '<button class="fu-submit">Upload</button>' : ''}
      `;
        }
        this.setContent(`
      <div class="fu-container">
        <div class="fu-label">${this.escapeHtml(label)}</div>
        <div class="fu-dropzone${this.submitted ? ' disabled' : ''}">
          <div class="fu-icon">\u2B06\uFE0F</div>
          <div class="fu-text"><strong>Click to browse</strong> or drag & drop</div>
          <div class="fu-hint">${[acceptHint, sizeHint].filter(Boolean).join(' \u2022 ')}</div>
          <input type="file" class="fu-file-input"
            ${accept ? `accept="${this.escapeHtml(accept)}"` : ''}
            ${multiple ? 'multiple' : ''}
            ${this.submitted ? 'disabled' : ''}
          />
        </div>
        ${fileInfoHtml}
      </div>
    `);
        if (!this.submitted) {
            const dropzone = this.shadowRoot?.querySelector('.fu-dropzone');
            const input = this.shadowRoot?.querySelector('.fu-file-input');
            const submitBtn = this.shadowRoot?.querySelector('.fu-submit');
            dropzone?.addEventListener('click', () => {
                input?.click();
            });
            dropzone?.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });
            dropzone?.addEventListener('dragleave', () => {
                dropzone.classList.remove('dragover');
            });
            dropzone?.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    this.handleFile(files[0], maxSizeMB);
                }
            });
            input?.addEventListener('change', () => {
                if (input.files && input.files.length > 0) {
                    this.handleFile(input.files[0], maxSizeMB);
                }
            });
            submitBtn?.addEventListener('click', () => {
                this.submitFile();
            });
        }
    }
    handleFile(file, maxSizeMB) {
        if (file.size > maxSizeMB * 1024 * 1024) {
            return; // File too large
        }
        this.selectedFile = file;
        this.render();
    }
    submitFile() {
        if (this.submitted || !this.selectedFile)
            return;
        this.submitted = true;
        this.render();
        this.emitAction('file-upload', {
            value: this.selectedFile.name,
            label: `Uploaded: ${this.selectedFile.name} (${this.formatSize(this.selectedFile.size)})`,
            file: {
                name: this.selectedFile.name,
                size: this.selectedFile.size,
                type: this.selectedFile.type,
            },
        });
    }
    formatSize(bytes) {
        if (bytes < 1024)
            return `${bytes} B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
const FILE_UPLOAD_REGISTRATION = {
    schema: {
        label: { type: 'string', default: 'Upload a file' },
        accept: { type: 'string', default: '' },
        maxSizeMB: { type: 'number', default: 10 },
        multiple: { type: 'boolean', default: false },
    },
    category: 'action',
    skeleton: {
        html: '<div style="height:120px;border-radius:8px;background:#e0e0e0;"></div>',
        height: '120px',
    },
};

/**
 * LiveLLM — Bring LLM responses to life.
 *
 * Interactive components for LLM responses.
 * Extends Markdown with Web Components.
 */
// Default singleton instance
const LiveLLM = new LiveLLMInstance();
// Register inline components
LiveLLM.register('alert', LiveLLMAlert, ALERT_REGISTRATION);
LiveLLM.register('badge', LiveLLMBadge, BADGE_REGISTRATION);
LiveLLM.register('progress', LiveLLMProgress, PROGRESS_REGISTRATION);
LiveLLM.register('tooltip', LiveLLMTooltip, TOOLTIP_REGISTRATION);
LiveLLM.register('rating', LiveLLMRating, RATING_REGISTRATION);
LiveLLM.register('counter', LiveLLMCounter, COUNTER_REGISTRATION);
LiveLLM.register('tag', LiveLLMTag, TAG_REGISTRATION);
// Register block components
LiveLLM.register('tabs', LiveLLMTabs, TABS_REGISTRATION);
LiveLLM.register('map', LiveLLMMap, MAP_REGISTRATION);
LiveLLM.register('chart', LiveLLMChart, CHART_REGISTRATION);
LiveLLM.register('form', LiveLLMForm, FORM_REGISTRATION);
LiveLLM.register('table-plus', LiveLLMTablePlus, TABLE_PLUS_REGISTRATION);
LiveLLM.register('accordion', LiveLLMAccordion, ACCORDION_REGISTRATION);
LiveLLM.register('steps', LiveLLMSteps, STEPS_REGISTRATION);
LiveLLM.register('timeline', LiveLLMTimeline, TIMELINE_REGISTRATION);
LiveLLM.register('video', LiveLLMVideo, VIDEO_REGISTRATION);
LiveLLM.register('pricing', LiveLLMPricing, PRICING_REGISTRATION);
LiveLLM.register('carousel', LiveLLMCarousel, CAROUSEL_REGISTRATION);
LiveLLM.register('file-preview', LiveLLMFilePreview, FILE_PREVIEW_REGISTRATION);
LiveLLM.register('calendar', LiveLLMCalendar, CALENDAR_REGISTRATION);
LiveLLM.register('link-preview', LiveLLMLinkPreview, LINK_PREVIEW_REGISTRATION);
LiveLLM.register('code-runner', LiveLLMCodeRunner, CODE_RUNNER_REGISTRATION);
// Register action components
LiveLLM.register('choice', LiveLLMChoice, CHOICE_REGISTRATION);
LiveLLM.register('confirm', LiveLLMConfirm, CONFIRM_REGISTRATION);
LiveLLM.register('multi-choice', LiveLLMMultiChoice, MULTI_CHOICE_REGISTRATION);
LiveLLM.register('rating-input', LiveLLMRatingInput, RATING_INPUT_REGISTRATION);
LiveLLM.register('date-picker', LiveLLMDatePicker, DATE_PICKER_REGISTRATION);
LiveLLM.register('text-input', LiveLLMTextInput, TEXT_INPUT_REGISTRATION);
LiveLLM.register('slider', LiveLLMSlider, SLIDER_REGISTRATION);
LiveLLM.register('file-upload', LiveLLMFileUpload, FILE_UPLOAD_REGISTRATION);

exports.Actions = Actions;
exports.EventBus = EventBus;
exports.LiveLLM = LiveLLM;
exports.LiveLLMAccordion = LiveLLMAccordion;
exports.LiveLLMAlert = LiveLLMAlert;
exports.LiveLLMBadge = LiveLLMBadge;
exports.LiveLLMCalendar = LiveLLMCalendar;
exports.LiveLLMCarousel = LiveLLMCarousel;
exports.LiveLLMChart = LiveLLMChart;
exports.LiveLLMChoice = LiveLLMChoice;
exports.LiveLLMCodeRunner = LiveLLMCodeRunner;
exports.LiveLLMComponent = LiveLLMComponent;
exports.LiveLLMConfirm = LiveLLMConfirm;
exports.LiveLLMCounter = LiveLLMCounter;
exports.LiveLLMDatePicker = LiveLLMDatePicker;
exports.LiveLLMFilePreview = LiveLLMFilePreview;
exports.LiveLLMFileUpload = LiveLLMFileUpload;
exports.LiveLLMForm = LiveLLMForm;
exports.LiveLLMInstance = LiveLLMInstance;
exports.LiveLLMLinkPreview = LiveLLMLinkPreview;
exports.LiveLLMMap = LiveLLMMap;
exports.LiveLLMMultiChoice = LiveLLMMultiChoice;
exports.LiveLLMPricing = LiveLLMPricing;
exports.LiveLLMProgress = LiveLLMProgress;
exports.LiveLLMRating = LiveLLMRating;
exports.LiveLLMRatingInput = LiveLLMRatingInput;
exports.LiveLLMSlider = LiveLLMSlider;
exports.LiveLLMSteps = LiveLLMSteps;
exports.LiveLLMTablePlus = LiveLLMTablePlus;
exports.LiveLLMTabs = LiveLLMTabs;
exports.LiveLLMTag = LiveLLMTag;
exports.LiveLLMTextInput = LiveLLMTextInput;
exports.LiveLLMTimeline = LiveLLMTimeline;
exports.LiveLLMTooltip = LiveLLMTooltip;
exports.LiveLLMVideo = LiveLLMVideo;
exports.Observer = Observer;
exports.Parser = Parser;
exports.Registry = Registry;
exports.Renderer = Renderer;
exports.StreamRenderer = StreamRenderer;
exports.Transformer = Transformer;
exports.addressDetector = addressDetector;
exports.builtInDetectors = builtInDetectors;
exports.codeDetector = codeDetector;
exports.connectLiveLLMStream = connectLiveLLMStream;
exports.createSSEWriter = createSSEWriter;
exports.dataDetector = dataDetector;
exports.default = LiveLLM;
exports.formatActionAsMessage = formatActionAsMessage;
exports.isDoneEvent = isDoneEvent;
exports.isErrorEvent = isErrorEvent;
exports.isMetadataEvent = isMetadataEvent;
exports.isStreamEvent = isStreamEvent;
exports.isTokenEvent = isTokenEvent;
exports.linkDetector = linkDetector;
exports.listDetector = listDetector;
exports.parseSSEData = parseSSEData;
exports.parseSSELine = parseSSELine;
exports.questionDetector = questionDetector;
exports.tableDetector = tableDetector;
//# sourceMappingURL=livellm.cjs.js.map
