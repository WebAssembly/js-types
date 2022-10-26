function assert_Function(func) {
  assert_equals(Object.getPrototypeOf(func), WebAssembly.Function.prototype,
                  "prototype");
  assert_true(Object.isExtensible(func), "extensible");
  assert_true(fun instanceof WebAssembly.Function);
  assert_true(fun instanceof Function);
  assert_true(fun instanceof Object);
  assert_equals(fun.__proto__, WebAssembly.Function.prototype);
  assert_equals(fun.__proto__.__proto__, Function.prototype);
  assert_equals(fun.__proto__.__proto__.__proto__, Object.prototype);
  assert_equals(fun.constructor, WebAssembly.Function);
  assert_equals(typeof fun, 'function');
}
