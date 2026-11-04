// Service worker da Clínica Bosque.
// Faz uma única coisa: quando o celular está sem internet, mostra a página "/offline.html" no lugar do erro
// do navegador. Não guarda páginas, respostas nem dados do sistema (são dados clínicos e financeiros).
const CACHE = "bosque-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // só navegações (abrir/atualizar uma tela); o resto vai direto à rede
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
