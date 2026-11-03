-- Sonidos grabados con el micrófono (botón «🎙 Grabar» en las fichas «Sonido»). Ni el navegador ni la
-- tablet graban en MP3: graban en AAC (.m4a, «audio/mp4») o, en algunos navegadores, en Opus
-- («audio/webm»). Se admiten además del MP3 de Freesound. Mismo límite de 1 MB (se graba como mucho 10 s).
update storage.buckets
set allowed_mime_types = array['audio/mpeg', 'audio/mp4', 'audio/webm']
where id = 'sonidos';
