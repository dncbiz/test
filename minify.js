const fs = require("fs");
const minify = require("html-minifier-terser").minify;

const file = "index.html";

(async () => {
  const html = fs.readFileSync(file, "utf8");

  const result = await minify(html, {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
    removeAttributeQuotes:false
  });

  fs.writeFileSync(file, result);
  console.log("✅ HTML 1줄화 완료");
})();