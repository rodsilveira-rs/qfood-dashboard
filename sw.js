/* Controle de Produção — service worker
   Estratégia: rede primeiro, cache como reserva.
   Assim a equipe sempre pega a versão nova quando há internet,
   e continua abrindo o sistema quando não há.
   Publique este arquivo na MESMA pasta do Index_Producao.html. */

// Cache versionado — bump o número aqui sempre que atualizar arquivos
// críticos (Index_CRM_Lead.html, Index_Menu.html, etc.) pra forçar o
// Service Worker a descartar a cópia antiga em todos os navegadores.
const CACHE = 'qfood-dashboard-v2';

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
      // Só cacheia respostas COMPLETAS (status 200). Status 206 (Partial Content)
      // vem de Range requests do navegador (vídeos, áudios, arquivos grandes) e
      // o Cache API não aceita — gera "Partial response (status code 206) is unsupported".
      // O try/catch extra blinda contra qualquer outra resposta que o cache rejeite.
      if (resp && resp.status === 200 && (resp.type === 'basic' || resp.type === 'cors')) {
        try { cache.put(req, resp.clone()); } catch(_){}
      }
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
