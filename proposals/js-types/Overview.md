# Overview

## Motivation

Wasm is typed, and its [types](https://webassembly.github.io/spec/core/syntax/types.html) carry information that can be useful and important to clients interacting with Wasm modules and objects through the JS API. For example, types describe the form of imports and exports, including the size limits of memories and tables or the mutability of globals. The desire to query information like this from JS has come up several times, for example, with the following issues:

* [WebAssembly/design#1046](https://github.com/WebAssembly/design/issues/1046)
* [WebAssembly/threads#87](https://github.com/WebAssembly/threads/issues/87)
* others?

For example, it is needed to write a JS-hosted linker or an adaptor mechanism for modules.

This proposal adds respective functionality to the JS API in a systematic manner.


## Summary

In a nutshell, this proposal consists of three parts:

* Define a representation of Wasm types as JS objects

* Extend API classes with a `type` method to retrieve the type of the underlying Wasm object

* To that end, introduce `WebAssembly.Function` as a new class, subclassing JavaScript's `Function`, to represent Wasm exported functions

The latter also provides a constructor for explicitly creating Wasm exported functions from regular JS functions. That enables JS code to put JS functions into a table, which is not currently possible.


## Type Representation

All Wasm types can be defined by a simple grammar. This grammar could be mapped to JSON-style JS objects in a direct and extensible manner. For example, using TypeScript-style type definitions:

```
type NumType = "i32" | "i64" | "f32" | "f64"
type ElemType = "anyfunc"
type GlobalType = {value: NumType, mutable: Bool}
type MemoryType = {limits: Limits}
type TableType = {limits: Limits, element: ElemType}
type Limits = {min: num, max?: num}
type FunctionType = {params: NumType[], results: NumType[]}
type ExternType = {kind: "function", type: FunctionType} | {kind: "memory", type: MemoryType} | {kind: "table", type: TableType} | {kind: "global", type: GlobalType}
```

Given the pre-existing JS API, we can repurpose (and rename) the existing descriptor interfaces of the API as types, and add the missing one for functions and extern types. The only difference to the above is that limits are inlined into memory and table types.

More concretely:

* Rename [ImportExportKind](https://webassembly.github.io/spec/js-api/index.html#modules) to ExternKind

* Rename [MemoryDescriptor](https://webassembly.github.io/spec/js-api/index.html#memories) to MemoryType

* Rename [TableDescriptor](https://webassembly.github.io/spec/js-api/index.html#tables) to TableType

* Rename [TableKind](https://webassembly.github.io/spec/js-api/index.html#tables) to ElemType

  Note: These renamings of spec-internal definitions are purely cosmetic and do not affect the observable API.

* Add a dictionary for function types:
  ```
  dictionary FunctionType {
    required sequence<NumType> parameters;
    required sequence<NumType> results;
  };
  ```

* Add a dictionary for external types:
  ```
  dictionary ExternType {
    required ExternKind kind;
    required (FunctionType or TableType or MemoryType or GlobalType) type;
  };
  ```
  As an additional constraint, the content of the `type` field must match that content of the `kind` field.

### Naming of size limits

There is one further quibble. The current definition of MemoryDescriptor and TableDescriptor names the attribute representing the minimum size `initial`. That makes sense for its use as an argument to the respective constructor, but nowhere else: with the more general use as a type, this attribute merely reflects a current or minimum required size, possibly after growing. For imports in particular, the minimum size in a type may be larger than both the current or initial size of an object matching that import.

Hence, the descriptor currently used for table and memory constructors does not properly represent the notion of type. On the other hand, it is useful for constructors to directly understand the types delivered by the reflection functions (see the [example](#example) below).

I hance propose to allow both `minimum` and `initial` as a name of that field. That is, they are both optional fields of the interface, but with the meta requirement that exactly one of them must be present. However, such a constraint cannot be epressed in WebIDL directly, but instead requires using auxiliary interfaces as follows:

* In both [MemoryDescriptor/Type](https://webassembly.github.io/spec/js-api/index.html#memories) and [TableDescriptor/Type](https://webassembly.github.io/spec/js-api/index.html#tables), rename `initial` to `minimum`

* Change the parameter type of the Memory constructor to `(MemoryType or InitialMemoryType)` where InitialMemoryType corresponds to the current MemoryDescriptor

* Change the parameter type of the Table constructor to `(TableType or InitialTableType)` where InitialTableType corresponds to the current TableDescriptor

Note: The last two points are simply a backwards compatibility measure that enables the constructors to continue understanding `initial` instead of `minimum` as a field name.


## Extensions to API functions

Types can be queried by adding the following attributes to the API.

* Make [ModuleExportDescriptor](https://webassembly.github.io/spec/js-api/index.html#modules) and [ModuleImportDescriptor](https://webassembly.github.io/spec/js-api/index.html#modules) derive from `ExternType`:
  ```
  dictionary ModuleExportDescriptor : ExternType { ... };
  dictionary ModuleImportDescriptor : ExternType { ... };
  ```
  The `kind` field is removed from both definitions and instead inherited, along with the additional `type` field.

* Extend interface [Memory](https://webassembly.github.io/spec/js-api/index.html#memories) with attribute
  ```
  static MemoryType type(Memory memory);
  ```

* Extend interface [Table](https://webassembly.github.io/spec/js-api/index.html#tables) with attribute
  ```
  static TableType type(Table table);
  ```

* Extend interface [Global](https://github.com/WebAssembly/mutable-global/blob/master/proposals/mutable-global/Overview.md#webassemblyglobal-objects) with
  ```
  static GlobalType type(Global global);
  ```

  Note: Following existing practice of JavaScript's `Object` API as well as the existing reflection functions on `WebAssembly.Module`, the above `type` methods are provided as static functions instead of attributes.

* Overload constructor [Memory](https://webassembly.github.io/spec/js-api/index.html#memories) (see above)
  ```
  Constructor(MemoryType or InitialMemoryType type)
  ```

* Overload constructor [Table](https://webassembly.github.io/spec/js-api/index.html#tables) (see above)
  ```
  Constructor(TableType or InitialTableType type)
  ```

* Adjust constructor [Global](https://github.com/WebAssembly/mutable-global/blob/master/proposals/mutable-global/Overview.md#webassemblyglobal-objects) to accept a GlobalType and its initialisation value separately:
  ```
  Constructor(GlobalType type, any value)
  ```


## Addition of `WebAssembly.Function`

Currently, Wasm [exported functions](https://webassembly.github.io/spec/js-api/index.html#exported-function-exotic-objects) are not assigned a special class. Instead, they are simply have JavaScript's built-in class `Function`.

This part of the proposal refines Wasm exported functions to have a suitable subclass, with the following advantages:

* A `type` attribute can be added to this class, reflecting a Wasm function's type in a manner consistent with the other type reflection attributes proposed above.

* The constructor for this class can be used to explicitly construct Wasm exported functions, closing a gap in the current API in that does not provide a way for JavaScript to put a plain JS function into a table (while the same is possible from inside Wasm).

* Wasm exported functions can be identified programmatically with an `instanceof` check.

Concretely, the change is the following:

* Introduce a new class `WebAssembly.Function` that is a subclass of `Function` as follows
  ```
  [LegacyNamespace=WebAssembly, Constructor(FunctionType type, function func), Exposed=(Window,Worker,Worklet)]
  interface Function : global.Function {
    static FunctionType type(Function func);
  };
  ```

* All exported functions are of class `WebAssembly.Function`.


## Example

The following function takes a `WebAssembly.Module` and creates a suitable mock import object for instantiating it:
```
function mockImports(module) {
  let mock = {};
  for (let import of WebAssembly.Module.imports(module)) {
    let value;
    switch (import.kind) {
      case "table":
        value = new WebAssembly.Table(import.type);
        break;
      case "memory":
        value = new WebAssembly.Memory(import.type);
        break;
      case "global":
        value = new WebAssembly.Global(import.type, undefined);
        break;
      case "function":
        value = () => { throw "unimplemented" };
        break;
    }
    if (! (import.module in mock)) mock[import.module] = {};
    mock[import.module][import.name] = value;
  }
  return mock;
}

let module = ...;
let instance = WebAssembly.instantiate(module, mockImports(module));
```

The following example shows how to use the `WebAssembly.Function` constructor to add a JavaScript function to a table, using multiple different types:
```
function print(...args) {
  for (let x of args) console.log(x + "\n")
}

let table = new Table({element: "anyfunc", minimum: 10});

let print_i32 = new WebAssembly.Function({parameters: ["i32"], results: []}, print);
table.set(0, print_i32);
let print_f64 = new WebAssembly.Function({parameters: ["f64"], results: []}, print);
table.set(1, print_f64);
let print_i32_i32 = new WebAssembly.Function({parameters: ["i32", "i32"], results: []}, print);
table.set(2, print_i32_i32);
```
