// Gera public/sw-precache-manifest.json a partir da saída real do build do Next.js
// (.next/app-build-manifest.json), como passo "postbuild" (roda sozinho depois de
// `next build`, convenção de lifecycle script do npm).
//
// Por quê: o Service Worker (public/sw.js) antes só sabia o HTML de cada página —
// os bundles JS/CSS que fazem aquela página funcionar de verdade só entravam no
// cache na primeira vez que alguém abria aquela aba específica estando online (ou,
// numa tentativa seguinte, eram "adivinhados" lendo o HTML renderizado com uma
// regex, o que falha pra qualquer chunk carregado depois, via import dinâmico).
// Agora o Next.js já sabe, no momento do build, EXATAMENTE quais arquivos cada
// rota precisa — este script só lê essa informação e grava numa lista que o
// Service Worker busca e cacheia por completo na instalação. Zero adivinhação.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const NEXT_DIR = path.join(ROOT, ".next");
const PUBLIC_DIR = path.join(ROOT, "public");

// Mesma lista de rotas que o app expõe pro uso offline (mantida aqui, não em
// public/sw.js, porque só este script roda em Node e consegue ler o manifesto
// de build — o sw.js consome o resultado já pronto).
const ROUTES = [
  "/", "/login", "/login/cadastro", "/offline.html",
  "/os", "/preventivas", "/pneus", "/backlog", "/afiacao", "/calendario",
  "/dashboard", "/indicadores", "/lavagens", "/captacao", "/programacao-preventiva",
  "/base-frotas", "/base-dados", "/documentos", "/checklist-mecanicos",
  "/mao-de-obra", "/lubrificacao", "/admin/usuarios", "/historico-exclusoes",
  "/horimetro", "/pcm", "/perfil", "/custos", "/semanal", "/insumos", "/privacidade",
];

function main() {
  const appManifestPath = path.join(NEXT_DIR, "app-build-manifest.json");
  if (!fs.existsSync(appManifestPath)) {
    console.warn("[generate-sw-manifest] .next/app-build-manifest.json não encontrado — pulando (build incompleto?).");
    return;
  }

  const buildId = fs.readFileSync(path.join(NEXT_DIR, "BUILD_ID"), "utf8").trim();
  const appManifest = JSON.parse(fs.readFileSync(appManifestPath, "utf8"));

  const assets = new Set();
  // Chunks do layout raiz (framework + CSS global) — toda página depende deles.
  (appManifest.pages["/layout"] || []).forEach((f) => assets.add(f));

  const semEntrada = [];
  ROUTES.forEach((route) => {
    if (route === "/offline.html") return; // arquivo estático, não é uma rota do App Router
    const key = route === "/" ? "/page" : `${route}/page`;
    const files = appManifest.pages[key];
    if (!files) { semEntrada.push(route); return; }
    files.forEach((f) => assets.add(f));
  });

  if (semEntrada.length) {
    console.warn("[generate-sw-manifest] Rotas sem entrada em app-build-manifest.json (confira o caminho):", semEntrada);
  }

  const manifest = {
    buildId,
    generatedAt: new Date().toISOString(),
    routes: ROUTES,
    assets: Array.from(assets).map((f) => `/_next/${f}`),
  };

  fs.writeFileSync(path.join(PUBLIC_DIR, "sw-precache-manifest.json"), JSON.stringify(manifest));
  console.log(`[generate-sw-manifest] OK — ${manifest.routes.length} rotas, ${manifest.assets.length} assets (build ${buildId}).`);
}

main();
