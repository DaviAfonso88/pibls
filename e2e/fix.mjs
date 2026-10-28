import fs from "node:fs";
const file = "specs/content.spec.ts";
let s = fs.readFileSync(file, "utf8");
const from = `    const [popup] = await Promise.all([page.waitForEvent("popup"), read.click()]);
    expect(popup.url()).toMatch(/\/uploads\/boletins\/\d{4}\/[0-9a-f]{32}\.pdf$/);
    await popup.close();

    // O arquivo é servido pelo Apache, com o tipo certo e o tamanho que foi enviado
    const href = (await read.getAttribute("href")) ?? "";`;
if (!s.includes(from)) throw new Error("nao achei");
s = s.replace(from, () => `    const [popup] = await Promise.all([page.waitForEvent("popup"), read.click()]);
    await popup.close();

    // O arquivo é servido pelo Apache, com o tipo certo e o tamanho que foi enviado
    const href = (await read.getAttribute("href")) ?? "";
    expect(href).toMatch(/\/uploads\/boletins\/\d{4}\/[0-9a-f]{32}\.pdf$/);`);
fs.writeFileSync(file, s);
