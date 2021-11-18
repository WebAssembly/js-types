// META: global=window,dedicatedworker,jsshell
// META: script=/wasm/jsapi/assertions.js

function assert_type(argument, element) {
    const mytable = new WebAssembly.Table(argument);
    const tabletype = mytable.type()
    assert_equals(tabletype.minimum, argument.minimum);
    assert_equals(tabletype.maximum, argument.maximum);
    assert_equals(tabletype.element, element);
}

test(() => {
    assert_type({ "minimum": 0, "element": "anyfunc"}, "funcref");
}, "anyfunc, Zero initial, no maximum");

test(() => {
    assert_type({ "minimum": 5, "element": "anyfunc" }, "funcref");
}, "anyfunc, Non-zero initial, no maximum");

test(() => {
    assert_type({ "minimum": 0, "maximum": 0, "element": "anyfunc" }, "funcref");
}, "anyfunc, Zero maximum");

test(() => {
    assert_type({ "minimum": 0, "maximum": 5, "element": "anyfunc" }, "funcref");
}, "anyfunc, Non-zero maximum");

test(() => {
    assert_type({ "minimum": 0, "element": "funcref"}, "funcref");
}, "funcref, Zero initial, no maximum");

test(() => {
    assert_type({ "minimum": 5, "element": "funcref" }, "funcref");
}, "funcref, Non-zero initial, no maximum");

test(() => {
    assert_type({ "minimum": 0, "maximum": 0, "element": "funcref" }, "funcref");
}, "funcref, Zero maximum");

test(() => {
    assert_type({ "minimum": 0, "maximum": 5, "element": "funcref" }, "funcref");
}, "funcref, Non-zero maximum");
