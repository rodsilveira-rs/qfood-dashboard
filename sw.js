/* Controle de Produção — service worker
   Estratégia: rede primeiro, cache como reserva.
   Assim a equipe sempre pega a versão nova quando há internet,
   e continua abrindo o sistema quando não há.
   Publique este arquivo na MESMA pasta do Index_Producao.html. */

const CACHE = 'controle-producao-v1';

self.addEventListener('install', ev => {
  self.skipWaiting();
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const mesmaOrigem = url.origin === self.location.origin;
  const fonteExterna = /fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(url.hostname);

  // Apps Script, Drive e qualquer outra chamada de dados: sempre rede, sem cache.
  if (!mesmaOrigem && !fonteExterna) return;

  ev.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const resp = await fetch(req);
      if (resp && resp.ok && (resp.type === 'basic' || resp.type === 'cors')) cache.put(req, resp.clone());
      return resp;
    } catch (e) {
      const salvo = await cache.match(req, { ignoreSearch: mesmaOrigem });
      if (salvo) return salvo;
      /* Página nunca visitada, offline: não existe cópia dela. Devolvemos o
         menu, que é de onde a pessoa alcança o que está guardado.
         (No qfood-dashboard não existe Index_Producao.html — a reserva
         antiga nunca casava com nada.) */
      if (req.mode === 'navigate') {
        const menu = await cache.match('Index_Menu.html', { ignoreSearch: true });
        if (menu) return menu;
      }
      throw e;
    }
  })());
});
