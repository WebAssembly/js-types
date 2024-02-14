// META: global=window,dedicatedworker,jsshell
// META: script=/wasm/jsapi/assertions.js
// META: script=/wasm/jsapi/function/assertions.js

test(() => {
  const builder = new WasmModuleBuilder();

  builder
    .addFunction("fun", kSig_v_v)
    .addBody([])
    .exportFunc();

  const instance = builder.instantiate({});
  const fun = instance.exports.fun;

  assert_Function(fun);
  assert_equals(fun(), undefined);
}, "Call exported function");

test(() => {
  let testcases = [
    [kSig_v_v, {parameters:[], results:[]}],
    [kSig_v_i, {parameters:["i32"], results:[]}],
    [kSig_i_l, {parameters:["i64"], results:["i32"]}],
    [kSig_v_ddi, {parameters:["f64", "f64", "i32"], results:[]}],
    [kSig_f_f, {parameters:["f32"], results:["f32"]}],
  ];
  testcases.forEach(function([sig, expected]) {
    let builder = new WasmModuleBuilder();
    builder.addFunction("fun", sig).addBody([kExprUnreachable]).exportFunc();
    let instance = builder.instantiate({});
    assert_Function(instance.exports.fun);
    let type = WebAssembly.Function.type(instance.exports.fun);
    assert_equals(expected, type);
    let module = new WebAssembly.Module(builder.toBuffer());
    let exports = WebAssembly.Module.exports(module);
    assert_equals("fun", exports[0].name);
    assert_true("type" in exports[0]);
    assert_equals(expected, exports[0].type);
  });
}, "Exported function type");

test(() => {
  let testcases = [
    [kSig_v_v, {parameters:[], results:[]}],
    [kSig_v_i, {parameters:["i32"], results:[]}],
    [kSig_i_l, {parameters:["i64"], results:["i32"]}],
    [kSig_v_ddi, {parameters:["f64", "f64", "i32"], results:[]}],
    [kSig_f_f, {parameters:["f32"], results:["f32"]}],
  ];
  testcases.forEach(function([sig, expected]) {
    let builder = new WasmModuleBuilder();
    builder.addImport("m", "fun", sig);
    let module = new WebAssembly.Module(builder.toBuffer());
    let imports = WebAssembly.Module.imports(module);
    assert_equals("fun", imports[0].name);
    assert_equals("m", imports[0].module);
    assert_true("type" in imports[0]);
    assert_equals(expected, imports[0].type);
  });
}, "Import function type");

test(() => {
  let obj1 = { valueOf: _ => 123.45 };
  let obj2 = { toString: _ => "456" };
  let gcer = { valueOf: _ => gc() };
  let testcases = [
    { params: { sig: ["i32"],
                val: [23.5],
                exp: [23], },
      result: { sig: ["i32"],
                val: 42.7,
                exp: 42, },
    },
    { params: { sig: ["i32", "f32", "f64"],
                val: [obj1,  obj2,  "789"],
                exp: [123,   456,   789], },
      result: { sig: [],
                val: undefined,
                exp: undefined, },
    },
    { params: { sig: ["i32", "f32", "f64"],
                val: [gcer,  {},    "xyz"],
                exp: [0,     NaN,   NaN], },
      result: { sig: ["f64"],
                val: gcer,
                exp: NaN, },
    },
  ];
  testcases.forEach(function({params, result}) {
    let p = params.sig; let r = result.sig; var params_after;
    function testFun() { params_after = arguments; return result.val; }
    let fun = new WebAssembly.Function({parameters:p, results:r}, testFun);
    let result_after = fun.apply(undefined, params.val);
    assert_array_equals(params.exp, params_after);
    assert_equals(result.exp, result_after);
  });
}, "Function constructed coercions");

test(() => {
  let builder = new WasmModuleBuilder();
  let fun = new WebAssembly.Function({parameters:[], results:["i64"]}, _ => 0n);
  let table = new WebAssembly.Table({element: "anyfunc", initial: 2});
  let table_index = builder.addImportedTable("m", "table", 2);
  let sig_index = builder.addType(kSig_l_v);
  table.set(0, fun);
  builder.addFunction('main', kSig_v_i)
      .addBody([
        kExprLocalGet, 0,
        kExprCallIndirect, sig_index, table_index,
        kExprDrop
      ])
      .exportFunc();
  let instance = builder.instantiate({ m: { table: table }});
  assert_equals(instance.exports.main(0), 0);
  assert_throws_js(RangeError, () => instance.exports.main(1), "instance.exports.main(1)");
  table.set(1, fun);
  assert_equals(instance.exports.main(1), 0);
}, "Function Table set");

test(() => {
  let builder = new WasmModuleBuilder();
  let fun = new WebAssembly.Function({parameters:[], results:["i32"]}, _ => 7);
  let fun_index = builder.addImport("m", "fun", kSig_i_v)
  builder.addFunction('main', kSig_i_v)
      .addBody([
        kExprCallFunction, fun_index
      ])
      .exportFunc();
  let instance = builder.instantiate({ m: { fun: fun }});
  assert_equals(7, instance.exports.main());
}, "Function Import matching a signature");

test(() => {
  let builder = new WasmModuleBuilder();
  let fun1 = new WebAssembly.Function({parameters:[], results:[]}, _ => 7);
  let fun2 = new WebAssembly.Function({parameters:["i32"], results:[]}, _ => 8);
  let fun3 = new WebAssembly.Function({parameters:[], results:["f32"]}, _ => 9);
  let fun_index = builder.addImport("m", "fun", kSig_i_v)
  builder.addFunction('main', kSig_i_v)
      .addBody([
        kExprCallFunction, fun_index
      ])
      .exportFunc();
  assert_throws_js(WebAssembly.LinkError,
    () => builder.instantiate({ m: { fun: fun1 }}),
    "builder.instantiate({ m: { fun: fun1 }})");
  assert_throws_js(WebAssembly.LinkError,
    () => builder.instantiate({ m: { fun: fun2 }}),
    "builder.instantiate({ m: { fun: fun2 }})");
  assert_throws_js(WebAssembly.LinkError,
    () => builder.instantiate({ m: { fun: fun3 }}),
    "builder.instantiate({ m: { fun: fun3 }})");
}, "Function Import mismatching a signature");

test(() => {
  let builder = new WasmModuleBuilder();
  let fun = new WebAssembly.Function({parameters:[], results:["i32"]}, _ => 7);
  let fun_index = builder.addImport("m", "fun", kSig_i_v)
  builder.addExport("fun1", fun_index);
  builder.addExport("fun2", fun_index);
  let instance = builder.instantiate({ m: { fun: fun }});
  assert_equals(instance.exports.fun1, instance.exports.fun2);
  assert_equals(fun, instance.exports.fun1);
}, "Function Import module import re-export");

test(() => {
  let imp = new WebAssembly.Function(
    {parameters:["i32", "i32", "i32"], results:["i32"]},
    function(a, b, c) { if (c) return a; return b; });

  let builder = new WasmModuleBuilder();
  let sig_index = builder.addType(kSig_i_iii);
  let fun_index = builder.addImport("m", "imp", kSig_i_iii)
  builder.addTable(kWasmFuncRef, 1, 1);
  let table_index = 0;
  let segment = builder.addActiveElementSegment(
      table_index, wasmI32Const(0), [[kExprRefFunc, 0]], kWasmFuncRef);

  let main = builder.addFunction("rc", kSig_i_i)
      .addBody([...wasmI32Const(-2), kExprI32Const, 3, kExprLocalGet, 0,
                kExprI32Const, 0, kExprCallIndirect, sig_index, table_index])
      .exportFunc();

  let instance = builder.instantiate({ m: { imp: imp }});

  assert_equals(instance.exports.rc(1), -2);
  assert_equals(instance.exports.rc(0), 3);
}, "Call_indirect js function");