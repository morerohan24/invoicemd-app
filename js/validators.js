/* Shared client-side validation helpers, mirroring backend/utils/validators.js.
   These run before a request is sent so the doctor gets instant feedback instead
   of waiting on a round-trip to the API for an obvious mistake. */

const Validate = (() => {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;
  const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
  const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-_]{1,64}$/;

  function isNonEmpty(v) {
    return typeof v === "string" && v.trim().length > 0;
  }
  function isEmail(v) {
    return isNonEmpty(v) && EMAIL_RE.test(v.trim());
  }
  function isPassword(v, min = 8) {
    return typeof v === "string" && v.length >= min;
  }
  function isPAN(v) {
    return isNonEmpty(v) && PAN_RE.test(v.trim());
  }
  function isGST(v) {
    return isNonEmpty(v) && GST_RE.test(v.trim());
  }
  function isUPI(v) {
    return isNonEmpty(v) && UPI_RE.test(v.trim());
  }
  function isNonNegativeNumber(v) {
    if (v === "" || v === null || v === undefined) return false;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0;
  }
  function isPositiveNumber(v) {
    if (v === "" || v === null || v === undefined) return false;
    const n = Number(v);
    return Number.isFinite(n) && n > 0;
  }

  return { isNonEmpty, isEmail, isPassword, isPAN, isGST, isUPI, isNonNegativeNumber, isPositiveNumber };
})();
