# stream-json で json データを stream のまま編集してみた

Node.js の stream を使うと、大きなデータを部分的にメモリ展開して確認することができます。
また Transform を使うことですべてのデータを展開することなくデータを編集することができます。

stream-json は json 形式の文字列データの stream を編集することができるライブラリです。
これをつかってどんなことができるのか、基本的な使い方を紹介します。

## 使い方

以下のような json ファイルがあると仮定します。

```json
[
  { "timestamp": 1682640000000, "temperature": 22 },
  { "timestamp": 1682643600000, "temperature": 27 },
  { "timestamp": 1682647200000, "temperature": 31 },
  { "timestamp": 1682650800000, "temperature": 33 },
  { "timestamp": 1682654400000, "temperature": 29 },
  { "timestamp": 1682658000000, "temperature": 27 },
  { "timestamp": 1682661600000, "temperature": 30 },
  { "timestamp": 1682665200000, "temperature": 35 },
  { "timestamp": 1682668800000, "temperature": 31 },
  { "timestamp": 1682672400000, "temperature": 28 }
]
```

これを`fs.createReadStream()`で読み取り、json を編集していみます。

### `pick()`

`pick()`を使うと、特定の要素を抜き出して新たな json を作成することができます。

```ts
import { createReadStream } from "node:fs";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/Pick";
import { stringer } from "stream-json/Stringer";

const stream = createReadStream("./simple-array-data.json")
  .pipe(parser())
  .pipe(pick({ filter: /\d+\.timestamp/ }))
  .pipe(stringer({ makeArray: true }));

// [
//   1682640000000,
//   1682643600000,
//   1682647200000,
//   1682650800000,
//   1682654400000,
//   1682658000000,
//   1682661600000,
//   1682665200000,
//   1682668800000,
//   1682672400000
// ]
```

### `filter()`

`filter()`を使うことで、json の階層を変えないまま特定の要素だけを残した json を新たに作成することができます。

```ts
import { createReadStream } from "node:fs";
import { parser } from "stream-json";
import { filter } from "stream-json/filters/Filter";
import { stringer } from "stream-json/Stringer";

const stream = createReadStream("./simple-array-data.json")
  .pipe(parser())
  .pipe(
    filter({
      filter: (stack) => typeof stack[0] === "number" && stack[0] % 5 === 0,
    })
  )
  .pipe(stringer());

// [
//   {"timestamp":1682640000000,"temperature":22},
//   {"timestamp":1682658000000,"temperature":27}
// ]
```

`stream-json`には`pick()`と`filter()`の他にも`ignore()`と`replace()`などの機能が用意されています。

### `streamValues()`

Values 系の機能を使うことで json 形式の文字列データをオブジェクトとして取り出すことができます。  
Values 系の機能は`stream-json`の作者が手掛ける別のライブラリ`stream-chain`と一緒に使います。

```ts
import { createReadStream } from "node:fs";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/Pick";
import { streamValues } from "stream-json/streamers/StreamValues";
import { disassembler } from "stream-json/Disassembler";
import { stringer } from "stream-json/Stringer";

const stream = chain([
  createReadStream("./simple-array-data.json"),
  parser(),
  pick({ filter: /\d+/ }),
  streamValues(),
  ({ value }) => {
    if (1682654400000 <= value.timestamp && value.timestamp < 1682661600000) {
      return [value];
    }
  },
  disassembler(),
  stringer({ makeArray: true }),
]);

// [
//   { timestamp: 1682654400000, temperature: 29 },
//   { timestamp: 1682658000000, temperature: 27 },
// ];
```
