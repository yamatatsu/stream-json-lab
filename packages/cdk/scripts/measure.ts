import { chain } from "stream-chain";

const urls = [
  // [
  //   "ddb 128",
  //   "https://ee4tybws5hh7r73ne3uicg3ynu0cjhlb.lambda-url.ap-northeast-1.on.aws/",
  // ],
  // [
  //   "ddb 256",
  //   "https://phjhit2ryjgld666dtiypdezl40ybkzr.lambda-url.ap-northeast-1.on.aws/",
  // ],
  // [
  //   "ddb 512",
  //   "https://hf6772k2rjax2hu2qvnzldkoke0okecp.lambda-url.ap-northeast-1.on.aws/",
  // ],
  // [
  //   "s3 128",
  //   "https://vzsl3hhfrachysolrwxyh2dahy0jpwou.lambda-url.ap-northeast-1.on.aws/",
  // ],
  // [
  //   "s3 256",
  //   "https://4wkeut3a5enhmimmqu6cnh7qre0yyycs.lambda-url.ap-northeast-1.on.aws/",
  // ],
  // [
  //   "s3 512",
  //   "https://olqobwkyxaseegzalfqresl55y0wggrz.lambda-url.ap-northeast-1.on.aws/",
  // ],
  // [
  //   "s3stream 128",
  //   "https://o7hz6ejwjxn7wgljo3kyfdthqe0xguci.lambda-url.ap-northeast-1.on.aws/",
  // ],
  // [
  //   "s3stream 256",
  //   "https://ivr4dp5pngrg5d3jqog53cdwvu0vegxq.lambda-url.ap-northeast-1.on.aws/",
  // ],
  // [
  //   "s3stream 512",
  //   "https://sovqi4njryfhihke6bsxc4wwq40ohleb.lambda-url.ap-northeast-1.on.aws/",
  // ],
  [
    "s3stream2 128",
    "https://cfegv35cttoapd3k6tkpuo4giu0sggcz.lambda-url.ap-northeast-1.on.aws/",
  ],
  [
    "s3stream2 256",
    "https://tb3t2iazkruldquurtsid23qkq0zwouj.lambda-url.ap-northeast-1.on.aws/",
  ],
  [
    "s3stream2 512",
    "https://hqz7iex5nzj3p5rcvnrixtizbe0btsug.lambda-url.ap-northeast-1.on.aws/",
  ],
];

main()
  .then(() => {
    console.log("done");
  })
  .catch((e) => {
    console.error(e);
  });

async function main() {
  const lines = [];
  for (const [name, url] of urls) {
    const line = await measureAverage(name, url);
    lines.push(line);
  }

  console.log(lines);
}

async function measureAverage(name: string, url: string) {
  await measure(url); // 1回目は遅いので捨てる
  const times = 5;
  const results = [];
  for (let i = 0; i < times; i++) {
    const result = await measure(url);
    results.push(result);
  }
  const average = results.reduce((acc, cur) => acc + cur, 0) / results.length;
  return `${name}: ${average}ms`;
}

/**
 * fetchで指定したURLにGETリクエストを送り、レスポンスまでにかかった時間(ms)を返す
 */
async function measure(url: string): Promise<number> {
  const start = Date.now();
  const res = await fetch(url);
  await res.text();
  const end = Date.now();
  return end - start;
}
