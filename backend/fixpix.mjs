import fs from "node:fs";
const file = "app/Modules/Content/Actions/UpdatePixSettings.php";
let s = fs.readFileSync(file, "utf8");
function sub(from, to) { if (!s.includes(from)) throw new Error("nao achei: " + from.slice(0, 50)); s = s.replace(from, () => to); }
sub(`        $errors = [];

        try {
            $key = Cnpj::from($input['pix_key']);`, `        $errors = [];
        $key = null;

        try {
            $key = Cnpj::from($input['pix_key']);`);
sub(`        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return [$key ?? throw new \LogicException('CNPJ validado'), trim($input['beneficiary_name']), $code];`, `        if ($key === null || $errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return [$key, trim($input['beneficiary_name']), $code];`);
fs.writeFileSync(file, s);
let e = fs.readFileSync("lang/pt_BR/errors.php", "utf8");
e = e.replace("    'palavra_viva_empty_body' => 'Escreva o texto da mensagem.',", () => "    'palavra_viva_empty_body' => 'Escreva o texto da mensagem.',\n    'pix_qr_required' => 'Envie o QR Code do PIX.',");
fs.writeFileSync("lang/pt_BR/errors.php", e);
