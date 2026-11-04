-- ============================================================
-- Cultos de segunda e quarta, Escola de Música e o credo (página Sobre)
-- ------------------------------------------------------------
-- • Segunda-Feira: 09:00 Consagração · 14:30 Círculo de Oração
-- • Quarta-Feira:  09:00 Consagração
-- • Departamentos: Escola de Música (sem dias/horários: a igreja completa
--   pelo painel → Departamentos)
-- • Sobre → "Nosso credo": o credo da Assembleia de Deus Belém – Sede
--   (https://ad.org.br/nosso-credo/), um artigo por linha; o site transforma
--   as referências bíblicas em links. Editável em Painel → Sobre a igreja.
-- Pode rodar mais de uma vez (não duplica). Cópia do que havia antes:
-- supabase/backups/*-2026-10-15-antes-cultos-credo.json
-- ============================================================
begin;

insert into public.services (day, items)
select v.day, v.items::jsonb from (values
  ('Segunda-Feira', '[{"name": "Consagração", "time": "09:00"}, {"name": "Círculo de Oração", "time": "14:30"}]'),
  ('Quarta-Feira',  '[{"name": "Consagração", "time": "09:00"}]')
) as v(day, items)
where not exists (select 1 from public.services s where s.day = v.day);

insert into public.ministries (name, description, image, responsible, instagram, whatsapp)
select 'Escola de Música',
       'Nossa igreja tem uma escola de música, com aulas. Para saber os dias, os horários e como participar, fale com a liderança da igreja.',
       '', '', '', ''
where not exists (select 1 from public.ministries where name = 'Escola de Música');

update public.settings
   set data = jsonb_set(data, '{about}', (data->'about') || jsonb_build_object(
     'faithSource', 'Assembleia de Deus Belém – Sede',
     'faithSourceUrl', 'https://ad.org.br/nosso-credo/',
     'faith', $credo$Cremos na inspiração divina verbal e plenária da Bíblia sagrada, única regra infalível de fé e prática para a vida e o caráter cristão (II Tm 3:14-17);
Em um só Deus, eternamente subsistente em três pessoas distintas que, embora distintas, são iguais em poder, glória e majestade: o Pai, o Filho e o Espírito Santo; Criador do Universo, de todas as coisas que há nos céus e na terra, visíveis e invisíveis, e, de maneira especial, os seres humanos, por um ato sobrenatural e imediato, e não por um processo evolutivo (Dt.6:4; Mt.28:19; Mc.12:29; Gn1:1; 2:7; Hb.11:3 e Ap.4:11);
No Senhor Jesus Cristo, o Filho Unigênito de Deus, plenamente Deus, plenamente Homem, na concepção e no seu nascimento virginal, em sua morte vicária e expiatória, em sua ressurreição corporal dentre os mortos e em sua ascensão vitoriosa aos céus como Salvador do mundo (Jo.3:16-18; Rm.1:3,4; Is.7:14; Mt.1:23; Hb.10:12; Rm.8:34 e At.1:9);
No Espírito Santo, a terceira pessoa da Santíssima Trindade, consubstancial com o Pai e o Filho, Senhor e Vivificador; que convence o mundo do pecado, da justiça e do juízo; que regenera o pecador; que falou por meio dos profetas e continua guiando o seu povo (II Cor.13:13; II Cor.3:6,17; Rm.8:2; Jo.16:11; Tt.3:5; II Pe 1:21 e Jo.16:13);
Na pecaminosidade do homem, que o destituiu da glória de Deus e que somente o arrependimento e a fé na obra expiatória e redentora de Jesus Cristo podem restaurá-lo a Deus (Rm.3:23; At.3:19);
Na necessidade absoluta do novo nascimento pela graça de Deus mediante a fé em Jesus Cristo e pelo poder atuante do Espírito santo para tornar o homem aceito no Reino dos Céus (Jo.3:3-8; Ef.2:8,9);
No perdão dos pecados, na salvação plena e na justificação pela fé no sacrifício efetuado por Jesus Cristo em nosso favor (At.10:43; Rm.10:13; 3:24-26; Hb.7:25; 5:9);
Na Igreja, que é o corpo de Cristo, coluna e firmeza da verdade, una, santa e universal assembleia dos fiéis remidos de todas as eras e de todos os lugares, chamados do mundo pelo Espírito Santo para seguir a Cristo e adorar a Deus (I Cor.12:27; Jo.4:23; I Tim.3:15; Hb.12:23 e Ap.22:17);
No batismo bíblico efetuado por imersão em águas, uma só vez, em nome do Pai, e do Filho, e do Espírito Santo, conforme determinou o Senhor Jesus Cristo (Mt.28:19; Rm.6:1-6; Cl. 2:12);
Na necessidade e na possibilidade de termos vida santa e irrepreensível por obra do Espírito Santo, que nos capacita a viver como fiéis testemunhas de Jesus Cristo (Hb.9:14; I Pe 1:15);
No batismo no Espírito Santo, conforme as Escrituras, que nos é dado por Jesus Cristo, demonstrado pela evidência física do falar em outras línguas, conforme a sua vontade (At.1:5; 2:4; 10:44-46; 19:1-7);
Na atualidade dos dons espirituais distribuídos pelo Espírito Santo à Igreja para sua edificação, conforme sua soberana vontade para o que for útil (I Co.12:1-12);
Na segunda vinda de Cristo, em duas fases distintas: a primeira – invisível ao mundo, para arrebatar a sua Igreja antes da Grande Tribulação; a segunda – visível e corporal, com a sua Igreja glorificada, para reinar sobre o mundo durante mil anos (I Ts.4:16,17; I Co.15:51-54; Ap.20:4; Zc.14:5 e Jd.1:14);
No comparecimento ante o Tribunal de Cristo de todos os cristãos arrebatados, para receberem a recompensa pelos seus feitos em favor da causa de Cristo na Terra (II Co.5:10);
No Juízo Final, onde comparecerão todos os ímpios; desde a Criação até o fim do Milênio, os que morrerem durante o período milenial e os que, ao final desta época, estiverem vivos. E na Eternidade de tristeza e tormento para os infiéis e vida eterna de gozo e felicidade para os fiéis de todos os tempos (Mt.25:46; Is.65:20; Ap.20:11-15; 21:1-4);
Cremos, também, que o casamento foi instituído por Deus e retificado por nosso Senhor Jesus Cristo como união entre um homem e uma mulher, nascidos macho e fêmea, respectivamente, em conformidade com o definido pelo sexo de criação geneticamente determinado (Gn.2:18; Jo.2:1,2; Gn.2:24; 1:27).$credo$))
 where id = 'main';

commit;

-- Conferência
select (select string_agg(day || ': ' || (select string_agg((i->>'time') || ' ' || (i->>'name'), ', ') from jsonb_array_elements(items) i), ' | ') from public.services) as cultos,
       (select count(*) from public.ministries where name = 'Escola de Música') as escola_de_musica,
       array_length(string_to_array(data->'about'->>'faith', E'
'), 1) as artigos_do_credo
  from public.settings where id = 'main';
