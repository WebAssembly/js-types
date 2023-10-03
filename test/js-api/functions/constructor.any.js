
// META: global=window,dedicatedworker,jsshell
// META: script=/wasm/jsapi/assertions.js
// META: script=/wasm/jsapi/function/assertions.js

test(() => {
  let desc = Object.getOwnPropertyDescriptor(WebAssembly, 'Function');
  assert_equals(typeof desc.value, 'function');
  assert_true(desc.writable);
  assert_true(desc.enumerable);
  assert_true(desc.configurable);
}, "constructor");

test(() => {
  assert_function_name(WebAssembly.Function, "Function", "WebAssembly.Function");
}, "name");

test(() => {
  assert_function_length(WebAssembly.Function, 2, "WebAssembly.Function");
}, "length");

test(() => {
  const longArr = new Array(1000 + 1);
  const invalidArguments = [
    undefined,
    null,
    false,
    true,
    "",
    "test",
    Symbol(),
    1,
    NaN,
    {},
    {parameters:[]},
    {parameters:['foo'], results:[]},
    {parameters:[], results:['foo']},
    {parameters:longArr, results:[]},
    {parameters:[], results:longArr},
  ];
  for (const invalidArgument of invalidArguments) {
    assert_throws_js(TypeError,
                      () => new WebAssembly.WebAssembly(invalidArgument, () => 0),
                      `new WebAssembly(${format_value(invalidArgument)}, () => 0)`);
  }
  const validDescriptor = {parameters:[], results:[]};
  // invalid function argument
  assert_throws_js(TypeError,
    () => new WebAssembly.WebAssembly(validDescriptor),
    `new WebAssembly(${format_value(validDescriptor)})`);
  assert_throws_js(TypeError,
    () => new WebAssembly.WebAssembly(validDescriptor, {}),
    `new WebAssembly(${format_value(validDescriptor)}, {})`);
}, "Invalid descriptor argument");

test(() => {
  const builder = new WasmModuleBuilder();

  builder
    .addFunction("func1", kSig_v_i)
    .addBody([])
    .exportFunc();
  builder
    .addFunction("func2", kSig_v_v)
    .addBody([])
    .exportFunc();

  const instance = builder.instantiate({});

  assert_throws_js(TypeError,
    () => new WebAssembly.WebAssembly(
        {parameters: [], results: []},
        instance.exports.func1
    ),
    `new WebAssembly({parameters: [], results: []},instance.exports.func1)`);
  assert_Function(new WebAssembly.WebAssembly(
      {parameters: [], results: []},
      instance.exports.func2
  ));
}, "Re-wrap Wasm Exported function");

test(() => {
  const func = new WebAssembly.Function({parameters: [], results: []}, _ => 0);
  assert_throws_js(TypeError,
    () => new WebAssembly.WebAssembly(
        {parameters: ['i32'], results: []},
        func
    ),
    `new WebAssembly({parameters: ['i32'], results: []},func)`);
  assert_Function(new WebAssembly.Function({parameters: [], results: []}, func));
}, "Re-wrap Wasm function with other signature");

test(() => {
  let log = [];  // Populated with a log of accesses.
  let two = { toString: () => "2" };  // Just a fancy "2".
  let logger = new Proxy({ length: two, "0": "i32", "1": "f32"}, {
    get: function(obj, prop) { log.push(prop); return Reflect.get(obj, prop); },
    set: function(obj, prop, val) { assertUnreachable(); }
  });
  let fun = new WebAssembly.Function({parameters:logger, results:[]}, _ => 0);
  assert_array_equals(["i32", "f32"], WebAssembly.Function.type(fun).parameters);
  assert_array_equals(["length", "0", "1"], log);
}, "Access signature");

test(() => {
  let throw1 = { get length() { throw new Error("cannot see length"); }};
  let throw2 = { length: { toString: _ => { throw new Error("no length") } } };
  let throw3 = { length: "not a length value, this also throws" };
  assert_throws_js(Error,
    () => new WebAssembly.Function({parameters:throw1, results:[]}),
    "new WebAssembly.Function({parameters:throw1, results:[]})");
  assert_throws_js(Error,
    () => new WebAssembly.Function({parameters:throw2, results:[]}),
    "new WebAssembly.Function({parameters:throw2, results:[]})");
  assert_throws_js(TypeError,
    () => new WebAssembly.Function({parameters:throw3, results:[]}),
    "new WebAssembly.Function({parameters:throw3, results:[]})");
  assert_throws_js(Error,
    () => new WebAssembly.Function({parameters:[], results:throw1}),
    "new WebAssembly.Function({parameters:[], results:throw1})");
  assert_throws_js(Error,
    () => new WebAssembly.Function({parameters:[], results:throw2}),
    "new WebAssembly.Function({parameters:[], results:throw2})");
  assert_throws_js(TypeError,
    () => new WebAssembly.Function({parameters:[], results:throw3}),
    "new WebAssembly.Function({parameters:[], results:throw3})");
}, "Throwing signature access");

test(() => {
  const fn = new WebAssembly.Function({parameters:[], results:[]}, _ => 0)
  assert_Function(fn);
  assert_equals(fn(), 0);
}, "Success construction");

test(() => {
  const testcases = [
    {parameters:[], results:[]},
    {parameters:["i32"], results:[]},
    {parameters:["i64"], results:["i32"]},
    {parameters:["f64", "f64", "i32"], results:[]},
    {parameters:["f32"], results:["f32"]},
  ];
  testcases.forEach(function(expected) {
    let fun = new WebAssembly.Function(expected, _ => 0);
    let type = WebAssembly.Function.type(fun);
    assert_equals(expected, type)
  });
}, "Function type");
