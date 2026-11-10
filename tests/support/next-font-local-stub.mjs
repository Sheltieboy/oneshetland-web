// Test-only stand-in for next/font/local: returns the shape the app reads (a CSS variable class name), like the next/font/google stub.
export default (opts = {}) => ({ className: "font-local", variable: `${opts.variable ?? "--font"}-cls`, style: { fontFamily: "local" } });
