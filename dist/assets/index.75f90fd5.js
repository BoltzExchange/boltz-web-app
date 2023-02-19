const en = function () {
  const t = document.createElement("link").relList;
  if (t && t.supports && t.supports("modulepreload")) return;
  for (const i of document.querySelectorAll('link[rel="modulepreload"]')) s(i);
  new MutationObserver((i) => {
    for (const r of i)
      if (r.type === "childList")
        for (const l of r.addedNodes)
          l.tagName === "LINK" && l.rel === "modulepreload" && s(l);
  }).observe(document, { childList: !0, subtree: !0 });
  function n(i) {
    const r = {};
    return (
      i.integrity && (r.integrity = i.integrity),
      i.referrerpolicy && (r.referrerPolicy = i.referrerpolicy),
      i.crossorigin === "use-credentials"
        ? (r.credentials = "include")
        : i.crossorigin === "anonymous"
        ? (r.credentials = "omit")
        : (r.credentials = "same-origin"),
      r
    );
  }
  function s(i) {
    if (i.ep) return;
    i.ep = !0;
    const r = n(i);
    fetch(i.href, r);
  }
};
en();
const D = {};
function tn(e) {
  D.context = e;
}
const nn = (e, t) => e === t,
  ot = { equals: nn };
let bt = Et;
const le = {},
  J = 1,
  Ce = 2,
  yt = { owned: null, cleanups: null, context: null, owner: null };
var M = null;
let ue = null,
  S = null,
  ie = null,
  B = null,
  x = null,
  Ke = 0;
function sn(e, t) {
  const n = S,
    s = M,
    i = e.length === 0,
    r = i ? yt : { owned: null, cleanups: null, context: null, owner: t || s },
    l = i ? e : () => e(() => Ye(r));
  (M = r), (S = null);
  try {
    return je(l, !0);
  } finally {
    (S = n), (M = s);
  }
}
function E(e, t) {
  t = t ? Object.assign({}, ot, t) : ot;
  const n = {
      value: e,
      observers: null,
      observerSlots: null,
      pending: le,
      comparator: t.equals || void 0,
    },
    s = (i) => (
      typeof i == "function" && (i = i(n.pending !== le ? n.pending : n.value)),
      Je(n, i)
    );
  return [on.bind(n), s];
}
function z(e, t, n) {
  const s = $t(e, t, !1, J);
  _e(s);
}
function be(e, t, n) {
  bt = un;
  const s = $t(e, t, !1, J),
    i = lt && At(M, lt.id);
  i && (s.suspense = i), (s.user = !0), x ? x.push(s) : _e(s);
}
function rn(e) {
  if (ie) return e();
  let t;
  const n = (ie = []);
  try {
    t = e();
  } finally {
    ie = null;
  }
  return (
    je(() => {
      for (let s = 0; s < n.length; s += 1) {
        const i = n[s];
        if (i.pending !== le) {
          const r = i.pending;
          (i.pending = le), Je(i, r);
        }
      }
    }, !1),
    t
  );
}
function vt(e) {
  let t,
    n = S;
  return (S = null), (t = e()), (S = n), t;
}
let lt;
function on() {
  const e = ue;
  if (this.sources && (this.state || e)) {
    const t = B;
    (B = null), this.state === J || e ? _e(this) : ye(this), (B = t);
  }
  if (S) {
    const t = this.observers ? this.observers.length : 0;
    S.sources
      ? (S.sources.push(this), S.sourceSlots.push(t))
      : ((S.sources = [this]), (S.sourceSlots = [t])),
      this.observers
        ? (this.observers.push(S),
          this.observerSlots.push(S.sources.length - 1))
        : ((this.observers = [S]),
          (this.observerSlots = [S.sources.length - 1]));
  }
  return this.value;
}
function Je(e, t, n) {
  if (ie) return e.pending === le && ie.push(e), (e.pending = t), t;
  if (e.comparator && e.comparator(e.value, t)) return t;
  let s = !1;
  return (
    (e.value = t),
    e.observers &&
      e.observers.length &&
      je(() => {
        for (let i = 0; i < e.observers.length; i += 1) {
          const r = e.observers[i];
          s && ue.disposed.has(r),
            ((s && !r.tState) || (!s && !r.state)) &&
              (r.pure ? B.push(r) : x.push(r), r.observers && _t(r)),
            s || (r.state = J);
        }
        if (B.length > 1e6) throw ((B = []), new Error());
      }, !1),
    t
  );
}
function _e(e) {
  if (!e.fn) return;
  Ye(e);
  const t = M,
    n = S,
    s = Ke;
  (S = M = e), ln(e, e.value, s), (S = n), (M = t);
}
function ln(e, t, n) {
  let s;
  try {
    s = e.fn(t);
  } catch (i) {
    St(i);
  }
  (!e.updatedAt || e.updatedAt <= n) &&
    (e.observers && e.observers.length ? Je(e, s) : (e.value = s),
    (e.updatedAt = n));
}
function $t(e, t, n, s = J, i) {
  const r = {
    fn: e,
    state: s,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: t,
    owner: M,
    context: null,
    pure: n,
  };
  return (
    M === null || (M !== yt && (M.owned ? M.owned.push(r) : (M.owned = [r]))), r
  );
}
function se(e) {
  const t = ue;
  if (e.state === 0 || t) return;
  if (e.state === Ce || t) return ye(e);
  if (e.suspense && vt(e.suspense.inFallback))
    return e.suspense.effects.push(e);
  const n = [e];
  for (; (e = e.owner) && (!e.updatedAt || e.updatedAt < Ke); )
    (e.state || t) && n.push(e);
  for (let s = n.length - 1; s >= 0; s--)
    if (((e = n[s]), e.state === J || t)) _e(e);
    else if (e.state === Ce || t) {
      const i = B;
      (B = null), ye(e, n[0]), (B = i);
    }
}
function je(e, t) {
  if (B) return e();
  let n = !1;
  t || (B = []), x ? (n = !0) : (x = []), Ke++;
  try {
    const s = e();
    return cn(n), s;
  } catch (s) {
    B || (x = null), St(s);
  }
}
function cn(e) {
  B && (Et(B), (B = null)),
    !e &&
      (x.length
        ? rn(() => {
            bt(x), (x = null);
          })
        : (x = null));
}
function Et(e) {
  for (let t = 0; t < e.length; t++) se(e[t]);
}
function un(e) {
  let t,
    n = 0;
  for (t = 0; t < e.length; t++) {
    const i = e[t];
    i.user ? (e[n++] = i) : se(i);
  }
  D.context && tn();
  const s = e.length;
  for (t = 0; t < n; t++) se(e[t]);
  for (t = s; t < e.length; t++) se(e[t]);
}
function ye(e, t) {
  const n = ue;
  e.state = 0;
  for (let s = 0; s < e.sources.length; s += 1) {
    const i = e.sources[s];
    i.sources &&
      (i.state === J || n
        ? i !== t && se(i)
        : (i.state === Ce || n) && ye(i, t));
  }
}
function _t(e) {
  const t = ue;
  for (let n = 0; n < e.observers.length; n += 1) {
    const s = e.observers[n];
    (!s.state || t) &&
      ((s.state = Ce), s.pure ? B.push(s) : x.push(s), s.observers && _t(s));
  }
}
function Ye(e) {
  let t;
  if (e.sources)
    for (; e.sources.length; ) {
      const n = e.sources.pop(),
        s = e.sourceSlots.pop(),
        i = n.observers;
      if (i && i.length) {
        const r = i.pop(),
          l = n.observerSlots.pop();
        s < i.length &&
          ((r.sourceSlots[l] = s), (i[s] = r), (n.observerSlots[s] = l));
      }
    }
  if (e.owned) {
    for (t = 0; t < e.owned.length; t++) Ye(e.owned[t]);
    e.owned = null;
  }
  if (e.cleanups) {
    for (t = 0; t < e.cleanups.length; t++) e.cleanups[t]();
    e.cleanups = null;
  }
  (e.state = 0), (e.context = null);
}
function St(e) {
  throw e;
}
function At(e, t) {
  return e
    ? e.context && e.context[t] !== void 0
      ? e.context[t]
      : At(e.owner, t)
    : void 0;
}
function Q(e, t) {
  return vt(() => e(t || {}));
}
function an(e, t, n) {
  let s = n.length,
    i = t.length,
    r = s,
    l = 0,
    o = 0,
    c = t[i - 1].nextSibling,
    a = null;
  for (; l < i || o < r; ) {
    if (t[l] === n[o]) {
      l++, o++;
      continue;
    }
    for (; t[i - 1] === n[r - 1]; ) i--, r--;
    if (i === l) {
      const u = r < s ? (o ? n[o - 1].nextSibling : n[r - o]) : c;
      for (; o < r; ) e.insertBefore(n[o++], u);
    } else if (r === o)
      for (; l < i; ) (!a || !a.has(t[l])) && t[l].remove(), l++;
    else if (t[l] === n[r - 1] && n[o] === t[i - 1]) {
      const u = t[--i].nextSibling;
      e.insertBefore(n[o++], t[l++].nextSibling),
        e.insertBefore(n[--r], u),
        (t[i] = n[r]);
    } else {
      if (!a) {
        a = new Map();
        let C = o;
        for (; C < r; ) a.set(n[C], C++);
      }
      const u = a.get(t[l]);
      if (u != null)
        if (o < u && u < r) {
          let C = l,
            h = 1,
            d;
          for (
            ;
            ++C < i && C < r && !((d = a.get(t[C])) == null || d !== u + h);

          )
            h++;
          if (h > u - o) {
            const m = t[l];
            for (; o < u; ) e.insertBefore(n[o++], m);
          } else e.replaceChild(n[o++], t[l++]);
        } else l++;
      else t[l++].remove();
    }
  }
}
const ct = "_$DX_DELEGATE";
function fn(e, t, n) {
  let s;
  return (
    sn((i) => {
      (s = i),
        t === document ? e() : N(t, e(), t.firstChild ? null : void 0, n);
    }),
    () => {
      s(), (t.textContent = "");
    }
  );
}
function te(e, t, n) {
  const s = document.createElement("template");
  s.innerHTML = e;
  let i = s.content.firstChild;
  return n && (i = i.firstChild), i;
}
function Se(e, t = window.document) {
  const n = t[ct] || (t[ct] = new Set());
  for (let s = 0, i = e.length; s < i; s++) {
    const r = e[s];
    n.has(r) || (n.add(r), t.addEventListener(r, dn));
  }
}
function me(e, t, n) {
  n == null ? e.removeAttribute(t) : e.setAttribute(t, n);
}
function q(e, t) {
  t == null ? e.removeAttribute("class") : (e.className = t);
}
function N(e, t, n, s) {
  if ((n !== void 0 && !s && (s = []), typeof t != "function"))
    return ve(e, t, s, n);
  z((i) => ve(e, t(), i, n), s);
}
function dn(e) {
  const t = `$$${e.type}`;
  let n = (e.composedPath && e.composedPath()[0]) || e.target;
  for (
    e.target !== n &&
      Object.defineProperty(e, "target", { configurable: !0, value: n }),
      Object.defineProperty(e, "currentTarget", {
        configurable: !0,
        get() {
          return n || document;
        },
      }),
      D.registry &&
        !D.done &&
        ((D.done = !0),
        document.querySelectorAll("[id^=pl-]").forEach((s) => s.remove()));
    n !== null;

  ) {
    const s = n[t];
    if (s && !n.disabled) {
      const i = n[`${t}Data`];
      if ((i !== void 0 ? s.call(n, i, e) : s.call(n, e), e.cancelBubble))
        return;
    }
    n =
      n.host && n.host !== n && n.host instanceof Node ? n.host : n.parentNode;
  }
}
function ve(e, t, n, s, i) {
  for (D.context && !n && (n = [...e.childNodes]); typeof n == "function"; )
    n = n();
  if (t === n) return n;
  const r = typeof t,
    l = s !== void 0;
  if (
    ((e = (l && n[0] && n[0].parentNode) || e),
    r === "string" || r === "number")
  ) {
    if (D.context) return n;
    if ((r === "number" && (t = t.toString()), l)) {
      let o = n[0];
      o && o.nodeType === 3 ? (o.data = t) : (o = document.createTextNode(t)),
        (n = Y(e, n, s, o));
    } else
      n !== "" && typeof n == "string"
        ? (n = e.firstChild.data = t)
        : (n = e.textContent = t);
  } else if (t == null || r === "boolean") {
    if (D.context) return n;
    n = Y(e, n, s);
  } else {
    if (r === "function")
      return (
        z(() => {
          let o = t();
          for (; typeof o == "function"; ) o = o();
          n = ve(e, o, n, s);
        }),
        () => n
      );
    if (Array.isArray(t)) {
      const o = [],
        c = n && Array.isArray(n);
      if (Fe(o, t, n, i)) return z(() => (n = ve(e, o, n, s, !0))), () => n;
      if (D.context) {
        for (let a = 0; a < o.length; a++) if (o[a].parentNode) return (n = o);
      }
      if (o.length === 0) {
        if (((n = Y(e, n, s)), l)) return n;
      } else
        c
          ? n.length === 0
            ? ut(e, o, s)
            : an(e, n, o)
          : (n && Y(e), ut(e, o));
      n = o;
    } else if (t instanceof Node) {
      if (D.context && t.parentNode) return (n = l ? [t] : t);
      if (Array.isArray(n)) {
        if (l) return (n = Y(e, n, s, t));
        Y(e, n, null, t);
      } else
        n == null || n === "" || !e.firstChild
          ? e.appendChild(t)
          : e.replaceChild(t, e.firstChild);
      n = t;
    }
  }
  return n;
}
function Fe(e, t, n, s) {
  let i = !1;
  for (let r = 0, l = t.length; r < l; r++) {
    let o = t[r],
      c = n && n[r];
    if (o instanceof Node) e.push(o);
    else if (!(o == null || o === !0 || o === !1))
      if (Array.isArray(o)) i = Fe(e, o, c) || i;
      else if (typeof o == "function")
        if (s) {
          for (; typeof o == "function"; ) o = o();
          i = Fe(e, Array.isArray(o) ? o : [o], c) || i;
        } else e.push(o), (i = !0);
      else {
        const a = String(o);
        c && c.nodeType === 3 && c.data === a
          ? e.push(c)
          : e.push(document.createTextNode(a));
      }
  }
  return i;
}
function ut(e, t, n) {
  for (let s = 0, i = t.length; s < i; s++) e.insertBefore(t[s], n);
}
function Y(e, t, n, s) {
  if (n === void 0) return (e.textContent = "");
  const i = s || document.createTextNode("");
  if (t.length) {
    let r = !1;
    for (let l = t.length - 1; l >= 0; l--) {
      const o = t[l];
      if (i !== o) {
        const c = o.parentNode === e;
        !r && !l
          ? c
            ? e.replaceChild(i, o)
            : e.insertBefore(i, n)
          : c && o.remove();
      } else r = !0;
    }
  } else e.insertBefore(i, n);
  return [i];
}
var hn = function () {
    return (
      typeof Promise == "function" &&
      Promise.prototype &&
      Promise.prototype.then
    );
  },
  Bt = {},
  P = {};
let Ge;
const gn = [
  0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655,
  733, 815, 901, 991, 1085, 1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921,
  2051, 2185, 2323, 2465, 2611, 2761, 2876, 3034, 3196, 3362, 3532, 3706,
];
P.getSymbolSize = function (t) {
  if (!t) throw new Error('"version" cannot be null or undefined');
  if (t < 1 || t > 40)
    throw new Error('"version" should be in range from 1 to 40');
  return t * 4 + 17;
};
P.getSymbolTotalCodewords = function (t) {
  return gn[t];
};
P.getBCHDigit = function (e) {
  let t = 0;
  for (; e !== 0; ) t++, (e >>>= 1);
  return t;
};
P.setToSJISFunction = function (t) {
  if (typeof t != "function")
    throw new Error('"toSJISFunc" is not a valid function.');
  Ge = t;
};
P.isKanjiModeEnabled = function () {
  return typeof Ge != "undefined";
};
P.toSJIS = function (t) {
  return Ge(t);
};
var Ae = {};
(function (e) {
  (e.L = { bit: 1 }),
    (e.M = { bit: 0 }),
    (e.Q = { bit: 3 }),
    (e.H = { bit: 2 });
  function t(n) {
    if (typeof n != "string") throw new Error("Param is not a string");
    switch (n.toLowerCase()) {
      case "l":
      case "low":
        return e.L;
      case "m":
      case "medium":
        return e.M;
      case "q":
      case "quartile":
        return e.Q;
      case "h":
      case "high":
        return e.H;
      default:
        throw new Error("Unknown EC Level: " + n);
    }
  }
  (e.isValid = function (s) {
    return s && typeof s.bit != "undefined" && s.bit >= 0 && s.bit < 4;
  }),
    (e.from = function (s, i) {
      if (e.isValid(s)) return s;
      try {
        return t(s);
      } catch {
        return i;
      }
    });
})(Ae);
function Tt() {
  (this.buffer = []), (this.length = 0);
}
Tt.prototype = {
  get: function (e) {
    const t = Math.floor(e / 8);
    return ((this.buffer[t] >>> (7 - (e % 8))) & 1) === 1;
  },
  put: function (e, t) {
    for (let n = 0; n < t; n++) this.putBit(((e >>> (t - n - 1)) & 1) === 1);
  },
  getLengthInBits: function () {
    return this.length;
  },
  putBit: function (e) {
    const t = Math.floor(this.length / 8);
    this.buffer.length <= t && this.buffer.push(0),
      e && (this.buffer[t] |= 128 >>> this.length % 8),
      this.length++;
  },
};
var pn = Tt;
function ae(e) {
  if (!e || e < 1)
    throw new Error("BitMatrix size must be defined and greater than 0");
  (this.size = e),
    (this.data = new Uint8Array(e * e)),
    (this.reservedBit = new Uint8Array(e * e));
}
ae.prototype.set = function (e, t, n, s) {
  const i = e * this.size + t;
  (this.data[i] = n), s && (this.reservedBit[i] = !0);
};
ae.prototype.get = function (e, t) {
  return this.data[e * this.size + t];
};
ae.prototype.xor = function (e, t, n) {
  this.data[e * this.size + t] ^= n;
};
ae.prototype.isReserved = function (e, t) {
  return this.reservedBit[e * this.size + t];
};
var mn = ae,
  Nt = {};
(function (e) {
  const t = P.getSymbolSize;
  (e.getRowColCoords = function (s) {
    if (s === 1) return [];
    const i = Math.floor(s / 7) + 2,
      r = t(s),
      l = r === 145 ? 26 : Math.ceil((r - 13) / (2 * i - 2)) * 2,
      o = [r - 7];
    for (let c = 1; c < i - 1; c++) o[c] = o[c - 1] - l;
    return o.push(6), o.reverse();
  }),
    (e.getPositions = function (s) {
      const i = [],
        r = e.getRowColCoords(s),
        l = r.length;
      for (let o = 0; o < l; o++)
        for (let c = 0; c < l; c++)
          (o === 0 && c === 0) ||
            (o === 0 && c === l - 1) ||
            (o === l - 1 && c === 0) ||
            i.push([r[o], r[c]]);
      return i;
    });
})(Nt);
var It = {};
const wn = P.getSymbolSize,
  at = 7;
It.getPositions = function (t) {
  const n = wn(t);
  return [
    [0, 0],
    [n - at, 0],
    [0, n - at],
  ];
};
var Mt = {};
(function (e) {
  e.Patterns = {
    PATTERN000: 0,
    PATTERN001: 1,
    PATTERN010: 2,
    PATTERN011: 3,
    PATTERN100: 4,
    PATTERN101: 5,
    PATTERN110: 6,
    PATTERN111: 7,
  };
  const t = { N1: 3, N2: 3, N3: 40, N4: 10 };
  (e.isValid = function (i) {
    return i != null && i !== "" && !isNaN(i) && i >= 0 && i <= 7;
  }),
    (e.from = function (i) {
      return e.isValid(i) ? parseInt(i, 10) : void 0;
    }),
    (e.getPenaltyN1 = function (i) {
      const r = i.size;
      let l = 0,
        o = 0,
        c = 0,
        a = null,
        u = null;
      for (let C = 0; C < r; C++) {
        (o = c = 0), (a = u = null);
        for (let h = 0; h < r; h++) {
          let d = i.get(C, h);
          d === a ? o++ : (o >= 5 && (l += t.N1 + (o - 5)), (a = d), (o = 1)),
            (d = i.get(h, C)),
            d === u ? c++ : (c >= 5 && (l += t.N1 + (c - 5)), (u = d), (c = 1));
        }
        o >= 5 && (l += t.N1 + (o - 5)), c >= 5 && (l += t.N1 + (c - 5));
      }
      return l;
    }),
    (e.getPenaltyN2 = function (i) {
      const r = i.size;
      let l = 0;
      for (let o = 0; o < r - 1; o++)
        for (let c = 0; c < r - 1; c++) {
          const a =
            i.get(o, c) +
            i.get(o, c + 1) +
            i.get(o + 1, c) +
            i.get(o + 1, c + 1);
          (a === 4 || a === 0) && l++;
        }
      return l * t.N2;
    }),
    (e.getPenaltyN3 = function (i) {
      const r = i.size;
      let l = 0,
        o = 0,
        c = 0;
      for (let a = 0; a < r; a++) {
        o = c = 0;
        for (let u = 0; u < r; u++)
          (o = ((o << 1) & 2047) | i.get(a, u)),
            u >= 10 && (o === 1488 || o === 93) && l++,
            (c = ((c << 1) & 2047) | i.get(u, a)),
            u >= 10 && (c === 1488 || c === 93) && l++;
      }
      return l * t.N3;
    }),
    (e.getPenaltyN4 = function (i) {
      let r = 0;
      const l = i.data.length;
      for (let c = 0; c < l; c++) r += i.data[c];
      return Math.abs(Math.ceil((r * 100) / l / 5) - 10) * t.N4;
    });
  function n(s, i, r) {
    switch (s) {
      case e.Patterns.PATTERN000:
        return (i + r) % 2 === 0;
      case e.Patterns.PATTERN001:
        return i % 2 === 0;
      case e.Patterns.PATTERN010:
        return r % 3 === 0;
      case e.Patterns.PATTERN011:
        return (i + r) % 3 === 0;
      case e.Patterns.PATTERN100:
        return (Math.floor(i / 2) + Math.floor(r / 3)) % 2 === 0;
      case e.Patterns.PATTERN101:
        return ((i * r) % 2) + ((i * r) % 3) === 0;
      case e.Patterns.PATTERN110:
        return (((i * r) % 2) + ((i * r) % 3)) % 2 === 0;
      case e.Patterns.PATTERN111:
        return (((i * r) % 3) + ((i + r) % 2)) % 2 === 0;
      default:
        throw new Error("bad maskPattern:" + s);
    }
  }
  (e.applyMask = function (i, r) {
    const l = r.size;
    for (let o = 0; o < l; o++)
      for (let c = 0; c < l; c++) r.isReserved(c, o) || r.xor(c, o, n(i, c, o));
  }),
    (e.getBestMask = function (i, r) {
      const l = Object.keys(e.Patterns).length;
      let o = 0,
        c = 1 / 0;
      for (let a = 0; a < l; a++) {
        r(a), e.applyMask(a, i);
        const u =
          e.getPenaltyN1(i) +
          e.getPenaltyN2(i) +
          e.getPenaltyN3(i) +
          e.getPenaltyN4(i);
        e.applyMask(a, i), u < c && ((c = u), (o = a));
      }
      return o;
    });
})(Mt);
var Be = {};
const V = Ae,
  fe = [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 2, 2, 4, 1, 2, 4, 4, 2, 4, 4, 4, 2,
    4, 6, 5, 2, 4, 6, 6, 2, 5, 8, 8, 4, 5, 8, 8, 4, 5, 8, 11, 4, 8, 10, 11, 4,
    9, 12, 16, 4, 9, 16, 16, 6, 10, 12, 18, 6, 10, 17, 16, 6, 11, 16, 19, 6, 13,
    18, 21, 7, 14, 21, 25, 8, 16, 20, 25, 8, 17, 23, 25, 9, 17, 23, 34, 9, 18,
    25, 30, 10, 20, 27, 32, 12, 21, 29, 35, 12, 23, 34, 37, 12, 25, 34, 40, 13,
    26, 35, 42, 14, 28, 38, 45, 15, 29, 40, 48, 16, 31, 43, 51, 17, 33, 45, 54,
    18, 35, 48, 57, 19, 37, 51, 60, 19, 38, 53, 63, 20, 40, 56, 66, 21, 43, 59,
    70, 22, 45, 62, 74, 24, 47, 65, 77, 25, 49, 68, 81,
  ],
  de = [
    7, 10, 13, 17, 10, 16, 22, 28, 15, 26, 36, 44, 20, 36, 52, 64, 26, 48, 72,
    88, 36, 64, 96, 112, 40, 72, 108, 130, 48, 88, 132, 156, 60, 110, 160, 192,
    72, 130, 192, 224, 80, 150, 224, 264, 96, 176, 260, 308, 104, 198, 288, 352,
    120, 216, 320, 384, 132, 240, 360, 432, 144, 280, 408, 480, 168, 308, 448,
    532, 180, 338, 504, 588, 196, 364, 546, 650, 224, 416, 600, 700, 224, 442,
    644, 750, 252, 476, 690, 816, 270, 504, 750, 900, 300, 560, 810, 960, 312,
    588, 870, 1050, 336, 644, 952, 1110, 360, 700, 1020, 1200, 390, 728, 1050,
    1260, 420, 784, 1140, 1350, 450, 812, 1200, 1440, 480, 868, 1290, 1530, 510,
    924, 1350, 1620, 540, 980, 1440, 1710, 570, 1036, 1530, 1800, 570, 1064,
    1590, 1890, 600, 1120, 1680, 1980, 630, 1204, 1770, 2100, 660, 1260, 1860,
    2220, 720, 1316, 1950, 2310, 750, 1372, 2040, 2430,
  ];
Be.getBlocksCount = function (t, n) {
  switch (n) {
    case V.L:
      return fe[(t - 1) * 4 + 0];
    case V.M:
      return fe[(t - 1) * 4 + 1];
    case V.Q:
      return fe[(t - 1) * 4 + 2];
    case V.H:
      return fe[(t - 1) * 4 + 3];
    default:
      return;
  }
};
Be.getTotalCodewordsCount = function (t, n) {
  switch (n) {
    case V.L:
      return de[(t - 1) * 4 + 0];
    case V.M:
      return de[(t - 1) * 4 + 1];
    case V.Q:
      return de[(t - 1) * 4 + 2];
    case V.H:
      return de[(t - 1) * 4 + 3];
    default:
      return;
  }
};
var Pt = {},
  Te = {};
const re = new Uint8Array(512),
  $e = new Uint8Array(256);
(function () {
  let t = 1;
  for (let n = 0; n < 255; n++)
    (re[n] = t), ($e[t] = n), (t <<= 1), t & 256 && (t ^= 285);
  for (let n = 255; n < 512; n++) re[n] = re[n - 255];
})();
Te.log = function (t) {
  if (t < 1) throw new Error("log(" + t + ")");
  return $e[t];
};
Te.exp = function (t) {
  return re[t];
};
Te.mul = function (t, n) {
  return t === 0 || n === 0 ? 0 : re[$e[t] + $e[n]];
};
(function (e) {
  const t = Te;
  (e.mul = function (s, i) {
    const r = new Uint8Array(s.length + i.length - 1);
    for (let l = 0; l < s.length; l++)
      for (let o = 0; o < i.length; o++) r[l + o] ^= t.mul(s[l], i[o]);
    return r;
  }),
    (e.mod = function (s, i) {
      let r = new Uint8Array(s);
      for (; r.length - i.length >= 0; ) {
        const l = r[0];
        for (let c = 0; c < i.length; c++) r[c] ^= t.mul(i[c], l);
        let o = 0;
        for (; o < r.length && r[o] === 0; ) o++;
        r = r.slice(o);
      }
      return r;
    }),
    (e.generateECPolynomial = function (s) {
      let i = new Uint8Array([1]);
      for (let r = 0; r < s; r++) i = e.mul(i, new Uint8Array([1, t.exp(r)]));
      return i;
    });
})(Pt);
const Lt = Pt;
function Qe(e) {
  (this.genPoly = void 0),
    (this.degree = e),
    this.degree && this.initialize(this.degree);
}
Qe.prototype.initialize = function (t) {
  (this.degree = t), (this.genPoly = Lt.generateECPolynomial(this.degree));
};
Qe.prototype.encode = function (t) {
  if (!this.genPoly) throw new Error("Encoder not initialized");
  const n = new Uint8Array(t.length + this.degree);
  n.set(t);
  const s = Lt.mod(n, this.genPoly),
    i = this.degree - s.length;
  if (i > 0) {
    const r = new Uint8Array(this.degree);
    return r.set(s, i), r;
  }
  return s;
};
var Cn = Qe,
  Rt = {},
  H = {},
  qe = {};
qe.isValid = function (t) {
  return !isNaN(t) && t >= 1 && t <= 40;
};
var U = {};
const xt = "[0-9]+",
  bn = "[A-Z $%*+\\-./:]+";
let ce =
  "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
ce = ce.replace(/u/g, "\\u");
const yn =
  "(?:(?![A-Z0-9 $%*+\\-./:]|" +
  ce +
  `)(?:.|[\r
]))+`;
U.KANJI = new RegExp(ce, "g");
U.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g");
U.BYTE = new RegExp(yn, "g");
U.NUMERIC = new RegExp(xt, "g");
U.ALPHANUMERIC = new RegExp(bn, "g");
const vn = new RegExp("^" + ce + "$"),
  $n = new RegExp("^" + xt + "$"),
  En = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
U.testKanji = function (t) {
  return vn.test(t);
};
U.testNumeric = function (t) {
  return $n.test(t);
};
U.testAlphanumeric = function (t) {
  return En.test(t);
};
(function (e) {
  const t = qe,
    n = U;
  (e.NUMERIC = { id: "Numeric", bit: 1 << 0, ccBits: [10, 12, 14] }),
    (e.ALPHANUMERIC = { id: "Alphanumeric", bit: 1 << 1, ccBits: [9, 11, 13] }),
    (e.BYTE = { id: "Byte", bit: 1 << 2, ccBits: [8, 16, 16] }),
    (e.KANJI = { id: "Kanji", bit: 1 << 3, ccBits: [8, 10, 12] }),
    (e.MIXED = { bit: -1 }),
    (e.getCharCountIndicator = function (r, l) {
      if (!r.ccBits) throw new Error("Invalid mode: " + r);
      if (!t.isValid(l)) throw new Error("Invalid version: " + l);
      return l >= 1 && l < 10
        ? r.ccBits[0]
        : l < 27
        ? r.ccBits[1]
        : r.ccBits[2];
    }),
    (e.getBestModeForData = function (r) {
      return n.testNumeric(r)
        ? e.NUMERIC
        : n.testAlphanumeric(r)
        ? e.ALPHANUMERIC
        : n.testKanji(r)
        ? e.KANJI
        : e.BYTE;
    }),
    (e.toString = function (r) {
      if (r && r.id) return r.id;
      throw new Error("Invalid mode");
    }),
    (e.isValid = function (r) {
      return r && r.bit && r.ccBits;
    });
  function s(i) {
    if (typeof i != "string") throw new Error("Param is not a string");
    switch (i.toLowerCase()) {
      case "numeric":
        return e.NUMERIC;
      case "alphanumeric":
        return e.ALPHANUMERIC;
      case "kanji":
        return e.KANJI;
      case "byte":
        return e.BYTE;
      default:
        throw new Error("Unknown mode: " + i);
    }
  }
  e.from = function (r, l) {
    if (e.isValid(r)) return r;
    try {
      return s(r);
    } catch {
      return l;
    }
  };
})(H);
(function (e) {
  const t = P,
    n = Be,
    s = Ae,
    i = H,
    r = qe,
    l =
      (1 << 12) |
      (1 << 11) |
      (1 << 10) |
      (1 << 9) |
      (1 << 8) |
      (1 << 5) |
      (1 << 2) |
      (1 << 0),
    o = t.getBCHDigit(l);
  function c(h, d, m) {
    for (let w = 1; w <= 40; w++) if (d <= e.getCapacity(w, m, h)) return w;
  }
  function a(h, d) {
    return i.getCharCountIndicator(h, d) + 4;
  }
  function u(h, d) {
    let m = 0;
    return (
      h.forEach(function (w) {
        m += a(w.mode, d) + w.getBitsLength();
      }),
      m
    );
  }
  function C(h, d) {
    for (let m = 1; m <= 40; m++)
      if (u(h, m) <= e.getCapacity(m, d, i.MIXED)) return m;
  }
  (e.from = function (d, m) {
    return r.isValid(d) ? parseInt(d, 10) : m;
  }),
    (e.getCapacity = function (d, m, w) {
      if (!r.isValid(d)) throw new Error("Invalid QR Code version");
      typeof w == "undefined" && (w = i.BYTE);
      const $ = t.getSymbolTotalCodewords(d),
        f = n.getTotalCodewordsCount(d, m),
        b = ($ - f) * 8;
      if (w === i.MIXED) return b;
      const p = b - a(w, d);
      switch (w) {
        case i.NUMERIC:
          return Math.floor((p / 10) * 3);
        case i.ALPHANUMERIC:
          return Math.floor((p / 11) * 2);
        case i.KANJI:
          return Math.floor(p / 13);
        case i.BYTE:
        default:
          return Math.floor(p / 8);
      }
    }),
    (e.getBestVersionForData = function (d, m) {
      let w;
      const $ = s.from(m, s.M);
      if (Array.isArray(d)) {
        if (d.length > 1) return C(d, $);
        if (d.length === 0) return 1;
        w = d[0];
      } else w = d;
      return c(w.mode, w.getLength(), $);
    }),
    (e.getEncodedBits = function (d) {
      if (!r.isValid(d) || d < 7) throw new Error("Invalid QR Code version");
      let m = d << 12;
      for (; t.getBCHDigit(m) - o >= 0; ) m ^= l << (t.getBCHDigit(m) - o);
      return (d << 12) | m;
    });
})(Rt);
var kt = {};
const De = P,
  Ft =
    (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
  _n = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1),
  ft = De.getBCHDigit(Ft);
kt.getEncodedBits = function (t, n) {
  const s = (t.bit << 3) | n;
  let i = s << 10;
  for (; De.getBCHDigit(i) - ft >= 0; ) i ^= Ft << (De.getBCHDigit(i) - ft);
  return ((s << 10) | i) ^ _n;
};
var Dt = {};
const Sn = H;
function W(e) {
  (this.mode = Sn.NUMERIC), (this.data = e.toString());
}
W.getBitsLength = function (t) {
  return 10 * Math.floor(t / 3) + (t % 3 ? (t % 3) * 3 + 1 : 0);
};
W.prototype.getLength = function () {
  return this.data.length;
};
W.prototype.getBitsLength = function () {
  return W.getBitsLength(this.data.length);
};
W.prototype.write = function (t) {
  let n, s, i;
  for (n = 0; n + 3 <= this.data.length; n += 3)
    (s = this.data.substr(n, 3)), (i = parseInt(s, 10)), t.put(i, 10);
  const r = this.data.length - n;
  r > 0 &&
    ((s = this.data.substr(n)), (i = parseInt(s, 10)), t.put(i, r * 3 + 1));
};
var An = W;
const Bn = H,
  Ie = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
    " ",
    "$",
    "%",
    "*",
    "+",
    "-",
    ".",
    "/",
    ":",
  ];
function Z(e) {
  (this.mode = Bn.ALPHANUMERIC), (this.data = e);
}
Z.getBitsLength = function (t) {
  return 11 * Math.floor(t / 2) + 6 * (t % 2);
};
Z.prototype.getLength = function () {
  return this.data.length;
};
Z.prototype.getBitsLength = function () {
  return Z.getBitsLength(this.data.length);
};
Z.prototype.write = function (t) {
  let n;
  for (n = 0; n + 2 <= this.data.length; n += 2) {
    let s = Ie.indexOf(this.data[n]) * 45;
    (s += Ie.indexOf(this.data[n + 1])), t.put(s, 11);
  }
  this.data.length % 2 && t.put(Ie.indexOf(this.data[n]), 6);
};
var Tn = Z,
  Nn = function (t) {
    for (var n = [], s = t.length, i = 0; i < s; i++) {
      var r = t.charCodeAt(i);
      if (r >= 55296 && r <= 56319 && s > i + 1) {
        var l = t.charCodeAt(i + 1);
        l >= 56320 &&
          l <= 57343 &&
          ((r = (r - 55296) * 1024 + l - 56320 + 65536), (i += 1));
      }
      if (r < 128) {
        n.push(r);
        continue;
      }
      if (r < 2048) {
        n.push((r >> 6) | 192), n.push((r & 63) | 128);
        continue;
      }
      if (r < 55296 || (r >= 57344 && r < 65536)) {
        n.push((r >> 12) | 224),
          n.push(((r >> 6) & 63) | 128),
          n.push((r & 63) | 128);
        continue;
      }
      if (r >= 65536 && r <= 1114111) {
        n.push((r >> 18) | 240),
          n.push(((r >> 12) & 63) | 128),
          n.push(((r >> 6) & 63) | 128),
          n.push((r & 63) | 128);
        continue;
      }
      n.push(239, 191, 189);
    }
    return new Uint8Array(n).buffer;
  };
const In = Nn,
  Mn = H;
function X(e) {
  (this.mode = Mn.BYTE), (this.data = new Uint8Array(In(e)));
}
X.getBitsLength = function (t) {
  return t * 8;
};
X.prototype.getLength = function () {
  return this.data.length;
};
X.prototype.getBitsLength = function () {
  return X.getBitsLength(this.data.length);
};
X.prototype.write = function (e) {
  for (let t = 0, n = this.data.length; t < n; t++) e.put(this.data[t], 8);
};
var Pn = X;
const Ln = H,
  Rn = P;
function ee(e) {
  (this.mode = Ln.KANJI), (this.data = e);
}
ee.getBitsLength = function (t) {
  return t * 13;
};
ee.prototype.getLength = function () {
  return this.data.length;
};
ee.prototype.getBitsLength = function () {
  return ee.getBitsLength(this.data.length);
};
ee.prototype.write = function (e) {
  let t;
  for (t = 0; t < this.data.length; t++) {
    let n = Rn.toSJIS(this.data[t]);
    if (n >= 33088 && n <= 40956) n -= 33088;
    else if (n >= 57408 && n <= 60351) n -= 49472;
    else
      throw new Error(
        "Invalid SJIS character: " +
          this.data[t] +
          `
Make sure your charset is UTF-8`
      );
    (n = ((n >>> 8) & 255) * 192 + (n & 255)), e.put(n, 13);
  }
};
var xn = ee,
  Ut = { exports: {} };
(function (e) {
  var t = {
    single_source_shortest_paths: function (n, s, i) {
      var r = {},
        l = {};
      l[s] = 0;
      var o = t.PriorityQueue.make();
      o.push(s, 0);
      for (var c, a, u, C, h, d, m, w, $; !o.empty(); ) {
        (c = o.pop()), (a = c.value), (C = c.cost), (h = n[a] || {});
        for (u in h)
          h.hasOwnProperty(u) &&
            ((d = h[u]),
            (m = C + d),
            (w = l[u]),
            ($ = typeof l[u] == "undefined"),
            ($ || w > m) && ((l[u] = m), o.push(u, m), (r[u] = a)));
      }
      if (typeof i != "undefined" && typeof l[i] == "undefined") {
        var f = ["Could not find a path from ", s, " to ", i, "."].join("");
        throw new Error(f);
      }
      return r;
    },
    extract_shortest_path_from_predecessor_list: function (n, s) {
      for (var i = [], r = s; r; ) i.push(r), n[r], (r = n[r]);
      return i.reverse(), i;
    },
    find_path: function (n, s, i) {
      var r = t.single_source_shortest_paths(n, s, i);
      return t.extract_shortest_path_from_predecessor_list(r, i);
    },
    PriorityQueue: {
      make: function (n) {
        var s = t.PriorityQueue,
          i = {},
          r;
        n = n || {};
        for (r in s) s.hasOwnProperty(r) && (i[r] = s[r]);
        return (i.queue = []), (i.sorter = n.sorter || s.default_sorter), i;
      },
      default_sorter: function (n, s) {
        return n.cost - s.cost;
      },
      push: function (n, s) {
        var i = { value: n, cost: s };
        this.queue.push(i), this.queue.sort(this.sorter);
      },
      pop: function () {
        return this.queue.shift();
      },
      empty: function () {
        return this.queue.length === 0;
      },
    },
  };
  e.exports = t;
})(Ut);
(function (e) {
  const t = H,
    n = An,
    s = Tn,
    i = Pn,
    r = xn,
    l = U,
    o = P,
    c = Ut.exports;
  function a(f) {
    return unescape(encodeURIComponent(f)).length;
  }
  function u(f, b, p) {
    const g = [];
    let y;
    for (; (y = f.exec(p)) !== null; )
      g.push({ data: y[0], index: y.index, mode: b, length: y[0].length });
    return g;
  }
  function C(f) {
    const b = u(l.NUMERIC, t.NUMERIC, f),
      p = u(l.ALPHANUMERIC, t.ALPHANUMERIC, f);
    let g, y;
    return (
      o.isKanjiModeEnabled()
        ? ((g = u(l.BYTE, t.BYTE, f)), (y = u(l.KANJI, t.KANJI, f)))
        : ((g = u(l.BYTE_KANJI, t.BYTE, f)), (y = [])),
      b
        .concat(p, g, y)
        .sort(function (_, T) {
          return _.index - T.index;
        })
        .map(function (_) {
          return { data: _.data, mode: _.mode, length: _.length };
        })
    );
  }
  function h(f, b) {
    switch (b) {
      case t.NUMERIC:
        return n.getBitsLength(f);
      case t.ALPHANUMERIC:
        return s.getBitsLength(f);
      case t.KANJI:
        return r.getBitsLength(f);
      case t.BYTE:
        return i.getBitsLength(f);
    }
  }
  function d(f) {
    return f.reduce(function (b, p) {
      const g = b.length - 1 >= 0 ? b[b.length - 1] : null;
      return g && g.mode === p.mode
        ? ((b[b.length - 1].data += p.data), b)
        : (b.push(p), b);
    }, []);
  }
  function m(f) {
    const b = [];
    for (let p = 0; p < f.length; p++) {
      const g = f[p];
      switch (g.mode) {
        case t.NUMERIC:
          b.push([
            g,
            { data: g.data, mode: t.ALPHANUMERIC, length: g.length },
            { data: g.data, mode: t.BYTE, length: g.length },
          ]);
          break;
        case t.ALPHANUMERIC:
          b.push([g, { data: g.data, mode: t.BYTE, length: g.length }]);
          break;
        case t.KANJI:
          b.push([g, { data: g.data, mode: t.BYTE, length: a(g.data) }]);
          break;
        case t.BYTE:
          b.push([{ data: g.data, mode: t.BYTE, length: a(g.data) }]);
      }
    }
    return b;
  }
  function w(f, b) {
    const p = {},
      g = { start: {} };
    let y = ["start"];
    for (let v = 0; v < f.length; v++) {
      const _ = f[v],
        T = [];
      for (let k = 0; k < _.length; k++) {
        const I = _[k],
          K = "" + v + k;
        T.push(K), (p[K] = { node: I, lastCount: 0 }), (g[K] = {});
        for (let j = 0; j < y.length; j++) {
          const L = y[j];
          p[L] && p[L].node.mode === I.mode
            ? ((g[L][K] =
                h(p[L].lastCount + I.length, I.mode) -
                h(p[L].lastCount, I.mode)),
              (p[L].lastCount += I.length))
            : (p[L] && (p[L].lastCount = I.length),
              (g[L][K] =
                h(I.length, I.mode) + 4 + t.getCharCountIndicator(I.mode, b)));
        }
      }
      y = T;
    }
    for (let v = 0; v < y.length; v++) g[y[v]].end = 0;
    return { map: g, table: p };
  }
  function $(f, b) {
    let p;
    const g = t.getBestModeForData(f);
    if (((p = t.from(b, g)), p !== t.BYTE && p.bit < g.bit))
      throw new Error(
        '"' +
          f +
          '" cannot be encoded with mode ' +
          t.toString(p) +
          `.
 Suggested mode is: ` +
          t.toString(g)
      );
    switch ((p === t.KANJI && !o.isKanjiModeEnabled() && (p = t.BYTE), p)) {
      case t.NUMERIC:
        return new n(f);
      case t.ALPHANUMERIC:
        return new s(f);
      case t.KANJI:
        return new r(f);
      case t.BYTE:
        return new i(f);
    }
  }
  (e.fromArray = function (b) {
    return b.reduce(function (p, g) {
      return (
        typeof g == "string"
          ? p.push($(g, null))
          : g.data && p.push($(g.data, g.mode)),
        p
      );
    }, []);
  }),
    (e.fromString = function (b, p) {
      const g = C(b, o.isKanjiModeEnabled()),
        y = m(g),
        v = w(y, p),
        _ = c.find_path(v.map, "start", "end"),
        T = [];
      for (let k = 1; k < _.length - 1; k++) T.push(v.table[_[k]].node);
      return e.fromArray(d(T));
    }),
    (e.rawSplit = function (b) {
      return e.fromArray(C(b, o.isKanjiModeEnabled()));
    });
})(Dt);
const Ne = P,
  Me = Ae,
  kn = pn,
  Fn = mn,
  Dn = Nt,
  Un = It,
  Ue = Mt,
  Oe = Be,
  On = Cn,
  Ee = Rt,
  zn = kt,
  Vn = H,
  Pe = Dt;
function Hn(e, t) {
  const n = e.size,
    s = Un.getPositions(t);
  for (let i = 0; i < s.length; i++) {
    const r = s[i][0],
      l = s[i][1];
    for (let o = -1; o <= 7; o++)
      if (!(r + o <= -1 || n <= r + o))
        for (let c = -1; c <= 7; c++)
          l + c <= -1 ||
            n <= l + c ||
            ((o >= 0 && o <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (o === 0 || o === 6)) ||
            (o >= 2 && o <= 4 && c >= 2 && c <= 4)
              ? e.set(r + o, l + c, !0, !0)
              : e.set(r + o, l + c, !1, !0));
  }
}
function Kn(e) {
  const t = e.size;
  for (let n = 8; n < t - 8; n++) {
    const s = n % 2 === 0;
    e.set(n, 6, s, !0), e.set(6, n, s, !0);
  }
}
function Jn(e, t) {
  const n = Dn.getPositions(t);
  for (let s = 0; s < n.length; s++) {
    const i = n[s][0],
      r = n[s][1];
    for (let l = -2; l <= 2; l++)
      for (let o = -2; o <= 2; o++)
        l === -2 || l === 2 || o === -2 || o === 2 || (l === 0 && o === 0)
          ? e.set(i + l, r + o, !0, !0)
          : e.set(i + l, r + o, !1, !0);
  }
}
function jn(e, t) {
  const n = e.size,
    s = Ee.getEncodedBits(t);
  let i, r, l;
  for (let o = 0; o < 18; o++)
    (i = Math.floor(o / 3)),
      (r = (o % 3) + n - 8 - 3),
      (l = ((s >> o) & 1) === 1),
      e.set(i, r, l, !0),
      e.set(r, i, l, !0);
}
function Le(e, t, n) {
  const s = e.size,
    i = zn.getEncodedBits(t, n);
  let r, l;
  for (r = 0; r < 15; r++)
    (l = ((i >> r) & 1) === 1),
      r < 6
        ? e.set(r, 8, l, !0)
        : r < 8
        ? e.set(r + 1, 8, l, !0)
        : e.set(s - 15 + r, 8, l, !0),
      r < 8
        ? e.set(8, s - r - 1, l, !0)
        : r < 9
        ? e.set(8, 15 - r - 1 + 1, l, !0)
        : e.set(8, 15 - r - 1, l, !0);
  e.set(s - 8, 8, 1, !0);
}
function Yn(e, t) {
  const n = e.size;
  let s = -1,
    i = n - 1,
    r = 7,
    l = 0;
  for (let o = n - 1; o > 0; o -= 2)
    for (o === 6 && o--; ; ) {
      for (let c = 0; c < 2; c++)
        if (!e.isReserved(i, o - c)) {
          let a = !1;
          l < t.length && (a = ((t[l] >>> r) & 1) === 1),
            e.set(i, o - c, a),
            r--,
            r === -1 && (l++, (r = 7));
        }
      if (((i += s), i < 0 || n <= i)) {
        (i -= s), (s = -s);
        break;
      }
    }
}
function Gn(e, t, n) {
  const s = new kn();
  n.forEach(function (c) {
    s.put(c.mode.bit, 4),
      s.put(c.getLength(), Vn.getCharCountIndicator(c.mode, e)),
      c.write(s);
  });
  const i = Ne.getSymbolTotalCodewords(e),
    r = Oe.getTotalCodewordsCount(e, t),
    l = (i - r) * 8;
  for (
    s.getLengthInBits() + 4 <= l && s.put(0, 4);
    s.getLengthInBits() % 8 !== 0;

  )
    s.putBit(0);
  const o = (l - s.getLengthInBits()) / 8;
  for (let c = 0; c < o; c++) s.put(c % 2 ? 17 : 236, 8);
  return Qn(s, e, t);
}
function Qn(e, t, n) {
  const s = Ne.getSymbolTotalCodewords(t),
    i = Oe.getTotalCodewordsCount(t, n),
    r = s - i,
    l = Oe.getBlocksCount(t, n),
    o = s % l,
    c = l - o,
    a = Math.floor(s / l),
    u = Math.floor(r / l),
    C = u + 1,
    h = a - u,
    d = new On(h);
  let m = 0;
  const w = new Array(l),
    $ = new Array(l);
  let f = 0;
  const b = new Uint8Array(e.buffer);
  for (let _ = 0; _ < l; _++) {
    const T = _ < c ? u : C;
    (w[_] = b.slice(m, m + T)),
      ($[_] = d.encode(w[_])),
      (m += T),
      (f = Math.max(f, T));
  }
  const p = new Uint8Array(s);
  let g = 0,
    y,
    v;
  for (y = 0; y < f; y++)
    for (v = 0; v < l; v++) y < w[v].length && (p[g++] = w[v][y]);
  for (y = 0; y < h; y++) for (v = 0; v < l; v++) p[g++] = $[v][y];
  return p;
}
function qn(e, t, n, s) {
  let i;
  if (Array.isArray(e)) i = Pe.fromArray(e);
  else if (typeof e == "string") {
    let a = t;
    if (!a) {
      const u = Pe.rawSplit(e);
      a = Ee.getBestVersionForData(u, n);
    }
    i = Pe.fromString(e, a || 40);
  } else throw new Error("Invalid data");
  const r = Ee.getBestVersionForData(i, n);
  if (!r)
    throw new Error("The amount of data is too big to be stored in a QR Code");
  if (!t) t = r;
  else if (t < r)
    throw new Error(
      `
The chosen QR Code version cannot contain this amount of data.
Minimum version required to store current data is: ` +
        r +
        `.
`
    );
  const l = Gn(t, n, i),
    o = Ne.getSymbolSize(t),
    c = new Fn(o);
  return (
    Hn(c, t),
    Kn(c),
    Jn(c, t),
    Le(c, n, 0),
    t >= 7 && jn(c, t),
    Yn(c, l),
    isNaN(s) && (s = Ue.getBestMask(c, Le.bind(null, c, n))),
    Ue.applyMask(s, c),
    Le(c, n, s),
    {
      modules: c,
      version: t,
      errorCorrectionLevel: n,
      maskPattern: s,
      segments: i,
    }
  );
}
Bt.create = function (t, n) {
  if (typeof t == "undefined" || t === "") throw new Error("No input text");
  let s = Me.M,
    i,
    r;
  return (
    typeof n != "undefined" &&
      ((s = Me.from(n.errorCorrectionLevel, Me.M)),
      (i = Ee.from(n.version)),
      (r = Ue.from(n.maskPattern)),
      n.toSJISFunc && Ne.setToSJISFunction(n.toSJISFunc)),
    qn(t, i, s, r)
  );
};
var Ot = {},
  We = {};
(function (e) {
  function t(n) {
    if ((typeof n == "number" && (n = n.toString()), typeof n != "string"))
      throw new Error("Color should be defined as hex string");
    let s = n.slice().replace("#", "").split("");
    if (s.length < 3 || s.length === 5 || s.length > 8)
      throw new Error("Invalid hex color: " + n);
    (s.length === 3 || s.length === 4) &&
      (s = Array.prototype.concat.apply(
        [],
        s.map(function (r) {
          return [r, r];
        })
      )),
      s.length === 6 && s.push("F", "F");
    const i = parseInt(s.join(""), 16);
    return {
      r: (i >> 24) & 255,
      g: (i >> 16) & 255,
      b: (i >> 8) & 255,
      a: i & 255,
      hex: "#" + s.slice(0, 6).join(""),
    };
  }
  (e.getOptions = function (s) {
    s || (s = {}), s.color || (s.color = {});
    const i =
        typeof s.margin == "undefined" || s.margin === null || s.margin < 0
          ? 4
          : s.margin,
      r = s.width && s.width >= 21 ? s.width : void 0,
      l = s.scale || 4;
    return {
      width: r,
      scale: r ? 4 : l,
      margin: i,
      color: {
        dark: t(s.color.dark || "#000000ff"),
        light: t(s.color.light || "#ffffffff"),
      },
      type: s.type,
      rendererOpts: s.rendererOpts || {},
    };
  }),
    (e.getScale = function (s, i) {
      return i.width && i.width >= s + i.margin * 2
        ? i.width / (s + i.margin * 2)
        : i.scale;
    }),
    (e.getImageWidth = function (s, i) {
      const r = e.getScale(s, i);
      return Math.floor((s + i.margin * 2) * r);
    }),
    (e.qrToImageData = function (s, i, r) {
      const l = i.modules.size,
        o = i.modules.data,
        c = e.getScale(l, r),
        a = Math.floor((l + r.margin * 2) * c),
        u = r.margin * c,
        C = [r.color.light, r.color.dark];
      for (let h = 0; h < a; h++)
        for (let d = 0; d < a; d++) {
          let m = (h * a + d) * 4,
            w = r.color.light;
          if (h >= u && d >= u && h < a - u && d < a - u) {
            const $ = Math.floor((h - u) / c),
              f = Math.floor((d - u) / c);
            w = C[o[$ * l + f] ? 1 : 0];
          }
          (s[m++] = w.r), (s[m++] = w.g), (s[m++] = w.b), (s[m] = w.a);
        }
    });
})(We);
(function (e) {
  const t = We;
  function n(i, r, l) {
    i.clearRect(0, 0, r.width, r.height),
      r.style || (r.style = {}),
      (r.height = l),
      (r.width = l),
      (r.style.height = l + "px"),
      (r.style.width = l + "px");
  }
  function s() {
    try {
      return document.createElement("canvas");
    } catch {
      throw new Error("You need to specify a canvas element");
    }
  }
  (e.render = function (r, l, o) {
    let c = o,
      a = l;
    typeof c == "undefined" && (!l || !l.getContext) && ((c = l), (l = void 0)),
      l || (a = s()),
      (c = t.getOptions(c));
    const u = t.getImageWidth(r.modules.size, c),
      C = a.getContext("2d"),
      h = C.createImageData(u, u);
    return (
      t.qrToImageData(h.data, r, c), n(C, a, u), C.putImageData(h, 0, 0), a
    );
  }),
    (e.renderToDataURL = function (r, l, o) {
      let c = o;
      typeof c == "undefined" &&
        (!l || !l.getContext) &&
        ((c = l), (l = void 0)),
        c || (c = {});
      const a = e.render(r, l, c),
        u = c.type || "image/png",
        C = c.rendererOpts || {};
      return a.toDataURL(u, C.quality);
    });
})(Ot);
var zt = {};
const Wn = We;
function dt(e, t) {
  const n = e.a / 255,
    s = t + '="' + e.hex + '"';
  return n < 1 ? s + " " + t + '-opacity="' + n.toFixed(2).slice(1) + '"' : s;
}
function Re(e, t, n) {
  let s = e + t;
  return typeof n != "undefined" && (s += " " + n), s;
}
function Zn(e, t, n) {
  let s = "",
    i = 0,
    r = !1,
    l = 0;
  for (let o = 0; o < e.length; o++) {
    const c = Math.floor(o % t),
      a = Math.floor(o / t);
    !c && !r && (r = !0),
      e[o]
        ? (l++,
          (o > 0 && c > 0 && e[o - 1]) ||
            ((s += r ? Re("M", c + n, 0.5 + a + n) : Re("m", i, 0)),
            (i = 0),
            (r = !1)),
          (c + 1 < t && e[o + 1]) || ((s += Re("h", l)), (l = 0)))
        : i++;
  }
  return s;
}
zt.render = function (t, n, s) {
  const i = Wn.getOptions(n),
    r = t.modules.size,
    l = t.modules.data,
    o = r + i.margin * 2,
    c = i.color.light.a
      ? "<path " +
        dt(i.color.light, "fill") +
        ' d="M0 0h' +
        o +
        "v" +
        o +
        'H0z"/>'
      : "",
    a =
      "<path " +
      dt(i.color.dark, "stroke") +
      ' d="' +
      Zn(l, r, i.margin) +
      '"/>',
    u = 'viewBox="0 0 ' + o + " " + o + '"',
    C = i.width ? 'width="' + i.width + '" height="' + i.width + '" ' : "",
    h =
      '<svg xmlns="http://www.w3.org/2000/svg" ' +
      C +
      u +
      ' shape-rendering="crispEdges">' +
      c +
      a +
      `</svg>
`;
  return typeof s == "function" && s(null, h), h;
};
const Xn = hn,
  ze = Bt,
  Vt = Ot,
  ei = zt;
function Ze(e, t, n, s, i) {
  const r = [].slice.call(arguments, 1),
    l = r.length,
    o = typeof r[l - 1] == "function";
  if (!o && !Xn()) throw new Error("Callback required as last argument");
  if (o) {
    if (l < 2) throw new Error("Too few arguments provided");
    l === 2
      ? ((i = n), (n = t), (t = s = void 0))
      : l === 3 &&
        (t.getContext && typeof i == "undefined"
          ? ((i = s), (s = void 0))
          : ((i = s), (s = n), (n = t), (t = void 0)));
  } else {
    if (l < 1) throw new Error("Too few arguments provided");
    return (
      l === 1
        ? ((n = t), (t = s = void 0))
        : l === 2 && !t.getContext && ((s = n), (n = t), (t = void 0)),
      new Promise(function (c, a) {
        try {
          const u = ze.create(n, s);
          c(e(u, t, s));
        } catch (u) {
          a(u);
        }
      })
    );
  }
  try {
    const c = ze.create(n, s);
    i(null, e(c, t, s));
  } catch (c) {
    i(c);
  }
}
ze.create;
Ze.bind(null, Vt.render);
Ze.bind(null, Vt.renderToDataURL);
Ze.bind(null, function (e, t, n) {
  return ei.render(e, n);
});
const ti = "http://localhost:9001",
  he = 1e8,
  ni = (e) => (e(), setInterval(e, 1e4)),
  R = () => {
    document.getElementById("sendAmount").focus();
  },
  ii = (e, t, n = null) => {
    let s = {};
    n &&
      ((n.referralId = "dni"),
      (s = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(n),
      })),
      fetch(ti + e, s)
        .then((i) => {
          if (!i.ok) throw new Error(`Request failed with status ${i.status}`);
          return i.json();
        })
        .then(t)
        .catch((i) => console.error(i));
  },
  [ge, oe] = E(0),
  [si, ri] = E(0),
  [oi, li] = E(0),
  [ht, ci] = E(0),
  [gt, pt] = E(0),
  [Ve, ui] = E(0),
  [He, ai] = E(0),
  [ne, O] = E(0),
  [fi, Ht] = E(0),
  [G, pe] = E(!1),
  [di, xe] = E(!1),
  [Pi, hi] = E(""),
  [Li, gi] = E(""),
  [pi, Ri] = E("");
E("");
E("");
E("");
E("");
const mi = te(
    '<div class="tags"><div class="tag"><span class="btn">min</span></div><div class="tag"><span class="btn">100K</span></div><div class="tag"><span class="btn">500K</span></div><div class="tag"><span class="btn">1M</span></div><div class="tag"><span class="btn">3M</span></div><div class="tag"><span class="btn">5M</span></div><div class="tag"><span class="btn">7M</span></div><div class="tag"><span class="btn">max</span></div></div>'
  ),
  wi = () =>
    (() => {
      const e = mi.cloneNode(!0),
        t = e.firstChild,
        n = t.firstChild,
        s = t.nextSibling,
        i = s.firstChild,
        r = s.nextSibling,
        l = r.firstChild,
        o = r.nextSibling,
        c = o.firstChild,
        a = o.nextSibling,
        u = a.firstChild,
        C = a.nextSibling,
        h = C.firstChild,
        d = C.nextSibling,
        m = d.firstChild,
        w = d.nextSibling,
        $ = w.firstChild;
      return (
        (n.$$click = (f) => {
          O(Ve()), F(), R();
        }),
        (i.$$click = (f) => {
          O(0.001), F(), R();
        }),
        (l.$$click = (f) => {
          O(0.005), F(), R();
        }),
        (c.$$click = (f) => {
          O(0.01), F(), R();
        }),
        (u.$$click = (f) => {
          O(0.03), F(), R();
        }),
        (h.$$click = (f) => {
          O(0.05), F(), R();
        }),
        (m.$$click = (f) => {
          O(0.07), F(), R();
        }),
        ($.$$click = (f) => {
          O(He()), F(), R();
        }),
        e
      );
    })();
Se(["click"]);
const Ci = te(
    '<div><h2>Create Submarine Swap</h2><p>Payment includes miner and boltz service fees.</p><hr><div class="icons"><div><span class="icon-1 icon"></span></div><div><div id="reverse"><input type="checkbox" value="true"></div></div><div><span class="icon-2 icon"></span></div></div><form name="swap" action="#"><div><div><input autofocus required step="0.00000001" maxlength="10" type="number" id="sendAmount"><label>BTC</label></div><div><span id="receiveAmount"></span><label>BTC</label></div></div></form><hr><div class="fees"><div class="fee"><span><b> BTC</b></span><br><label>Min. amount</label></div><div class="fee"><span><b> BTC</b></span><br><label>Max. amount</label></div><div class="fee"><span><b> %</b></span><br><label>Boltz fee</label></div><div class="fee"><span><b> BTC</b></span><br><label>Miner fee</label></div></div><hr><label id="invoiceLabel">Create an invoice with exactly <b></b> sats and paste it here</label><textarea id="invoice" name="invoice" placeholder="Paste lightning invoice"></textarea><input type="text" id="onchainAddress" name="onchainAddress" placeholder="On-chain address"><hr><p>creates a swap and go to the invoicing step.</p></div>'
  ),
  F = (e) => {
    let t = "",
      n = document.getElementById("sendAmount");
    n.checkValidity(), xe(!1);
    for (let s in n.validity)
      if (s !== "valid") {
        if (n.validity[s]) {
          (t = s), xe(!1);
          break;
        }
        xe(!0);
      }
    di() ? O(n.value) : Ht(t);
  },
  bi = () => (
    ni(() => {
      ii("/getpairs", (e) => {
        let t = e.pairs["BTC/BTC"];
        ri(t);
      });
    }),
    be(() => {
      let e = si();
      if (e)
        if (
          (ui(e.limits.minimal / he),
          ai(e.limits.maximal / he),
          ci(e.fees.percentage),
          G())
        ) {
          let t = e.fees.minerFees.baseAsset.reverse,
            n = (t.claim + t.lockup) / he;
          pt(n.toFixed(8));
        } else {
          let t = e.fees.minerFees.baseAsset.normal / he;
          pt(t.toFixed(8));
        }
    }),
    be(() => {
      let e = ne() - gt() - (ne() * ht()) / 100;
      Ht(e.toFixed(8));
    }),
    (() => {
      const e = Ci.cloneNode(!0),
        t = e.firstChild,
        n = t.nextSibling,
        s = n.nextSibling,
        i = s.nextSibling,
        r = i.firstChild,
        l = r.firstChild,
        o = r.nextSibling,
        c = o.firstChild,
        a = c.firstChild,
        u = o.nextSibling,
        C = u.firstChild,
        h = i.nextSibling,
        d = h.firstChild,
        m = d.firstChild,
        w = m.firstChild,
        $ = m.nextSibling,
        f = $.firstChild,
        b = h.nextSibling,
        p = b.nextSibling,
        g = p.firstChild,
        y = g.firstChild,
        v = y.firstChild,
        _ = v.firstChild,
        T = g.nextSibling,
        k = T.firstChild,
        I = k.firstChild,
        K = I.firstChild,
        j = T.nextSibling,
        L = j.firstChild,
        Xe = L.firstChild,
        jt = Xe.firstChild,
        Yt = j.nextSibling,
        Gt = Yt.firstChild,
        et = Gt.firstChild,
        Qt = et.firstChild,
        qt = p.nextSibling,
        tt = qt.nextSibling,
        Wt = tt.firstChild,
        Zt = Wt.nextSibling,
        nt = tt.nextSibling,
        Xt = nt.nextSibling;
      return (
        (l.$$click = (A) => {
          pe(!G()), R();
        }),
        a.addEventListener("change", (A) => {
          pe(A.currentTarget.checked), R();
        }),
        (C.$$click = (A) => pe(!G())),
        (w.$$keyup = F),
        w.addEventListener("change", F),
        (f.$$click = (A) => {
          pe(!G()), R();
        }),
        N(f, fi),
        N(e, Q(wi, {}), b),
        N(v, Ve, _),
        N(I, He, K),
        N(Xe, ht, jt),
        N(et, gt, Qt),
        N(Zt, () => Math.floor(ne() * 1e8)),
        nt.addEventListener("change", (A) => gi(A.currentTarget.value)),
        Xt.addEventListener("change", (A) => hi(A.currentTarget.value)),
        z(
          (A) => {
            const it = G(),
              st = Ve(),
              rt = He();
            return (
              it !== A._v$ && me(e, "data-reverse", (A._v$ = it)),
              st !== A._v$2 && me(w, "min", (A._v$2 = st)),
              rt !== A._v$3 && me(w, "max", (A._v$3 = rt)),
              A
            );
          },
          { _v$: void 0, _v$2: void 0, _v$3: void 0 }
        ),
        z(() => (a.checked = G())),
        z(() => (w.value = ne())),
        e
      );
    })()
  );
Se(["click", "keyup"]);
const yi = te(
    '<div><h2>Pay invoice</h2><p>Pay your invoice and the swap is done.</p><hr><img id="invoice-qr" alt="pay invoice qr"></div>'
  ),
  vi = () =>
    (() => {
      const e = yi.cloneNode(!0),
        t = e.firstChild,
        n = t.nextSibling,
        s = n.nextSibling,
        i = s.nextSibling;
      return z(() => me(i, "src", pi())), e;
    })(),
  $i = te(
    '<div><h2>Congratulations!</h2><p>You have successfully swapped <!> BTC.</p><hr><div class="animation-spacer"><div class="bitcoin-icon rotate infinite linear"></div></div></div>'
  ),
  Ei = () =>
    (() => {
      const e = $i.cloneNode(!0),
        t = e.firstChild,
        n = t.nextSibling,
        s = n.firstChild,
        i = s.nextSibling;
      return i.nextSibling, N(n, ne, i), e;
    })(),
  _i = te(
    '<div class="frame"><h2>Refund a failed swap</h2><p>Upload your refund.json file and reclaim you on-chain funds</p><hr><input type="text" id="refundAddress" name="refundAddress" placeholder="Refund On-chain address"><input type="file" id="refundUpload"><div><span class="error"></span></div><div><span class="btn btn-success">refund</span></div></div>'
  ),
  [ke, we] = E("no file seleced"),
  [Kt, mt] = E(null),
  [Jt, wt] = E(null);
be(() => {
  new Response(oi()).json().then(
    (e) => {
      e !== 0 && mt(e);
    },
    (e) => {
      mt(null), we("not a json file");
    }
  );
});
be(() => {
  if (Jt() === null) return we("no refund address");
  if (Kt() === null) return we("no json file");
  we(!1);
});
const Si = (e) => {
    console.log("not implemented yet", Jt(), Kt());
  },
  Ct = (e) => {
    let t = e.currentTarget;
    t.value.trim() ? wt(t.value.trim()) : wt(null);
  },
  Ai = () =>
    (() => {
      const e = _i.cloneNode(!0),
        t = e.firstChild,
        n = t.nextSibling,
        s = n.nextSibling,
        i = s.nextSibling,
        r = i.nextSibling,
        l = r.nextSibling,
        o = l.firstChild,
        c = l.nextSibling,
        a = c.firstChild;
      return (
        i.addEventListener("change", Ct),
        (i.$$keyup = Ct),
        r.addEventListener("change", (u) => li(u.currentTarget.files[0])),
        N(o, ke),
        (a.$$click = Si),
        z(
          (u) => {
            const C = ke() === !1 ? "hidden" : "",
              h = ke() !== !1 ? "hidden" : "";
            return (
              C !== u._v$ && q(l, (u._v$ = C)),
              h !== u._v$2 && q(c, (u._v$2 = h)),
              u
            );
          },
          { _v$: void 0, _v$2: void 0 }
        ),
        e
      );
    })();
Se(["keyup", "click"]);
const Bi = te(
    '<div><div id="steps"><div><div class="container"><span class="btn">refund</span><span class="btn btn-success">create</span></div></div><div><div class="container"><span class="btn btn-danger">cancel</span><span class="btn btn-success">success</span></div></div><div><div class="container"><hr><span class="btn btn-success">new swap</span><a class="btn" target="_blank" href="https://mempool.space">mempool</a></div></div><div><div class="container"><span class="btn btn-danger">cancel</span></div></div></div></div>'
  ),
  Ti = () => {},
  Ni = (e) => oe(2),
  Ii = (e) => oe(3),
  Mi = () =>
    (() => {
      const e = Bi.cloneNode(!0),
        t = e.firstChild,
        n = t.firstChild,
        s = n.firstChild,
        i = s.firstChild,
        r = i.nextSibling,
        l = n.nextSibling,
        o = l.firstChild,
        c = o.firstChild,
        a = c.nextSibling,
        u = l.nextSibling,
        C = u.firstChild,
        h = C.firstChild,
        d = h.nextSibling,
        m = u.nextSibling,
        w = m.firstChild,
        $ = w.firstChild;
      return (
        N(s, Q(bi, {}), i),
        (i.$$click = Ii),
        (r.$$click = Ti),
        N(o, Q(vi, {}), c),
        (c.$$click = (f) => oe(0)),
        (a.$$click = Ni),
        N(C, Q(Ei, {}), h),
        (d.$$click = (f) => oe(0)),
        N(w, Q(Ai, {}), $),
        ($.$$click = (f) => oe(0)),
        z(
          (f) => {
            const b = ge() == 0 ? "active" : "",
              p = ge() == 1 ? "active" : "",
              g = ge() == 2 ? "active" : "",
              y = ge() == 3 ? "active" : "";
            return (
              b !== f._v$ && q(n, (f._v$ = b)),
              p !== f._v$2 && q(l, (f._v$2 = p)),
              g !== f._v$3 && q(u, (f._v$3 = g)),
              y !== f._v$4 && q(m, (f._v$4 = y)),
              f
            );
          },
          { _v$: void 0, _v$2: void 0, _v$3: void 0, _v$4: void 0 }
        ),
        e
      );
    })();
Se(["click"]);
document.getElementById("toggle-rainbow").addEventListener("click", (e) => {
  document.body.classList.contains("rainbow")
    ? document.body.classList.remove("rainbow")
    : document.body.classList.add("rainbow");
});
fn(() => Q(Mi, {}), document.getElementById("root"));
