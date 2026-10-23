# Central Executiva — Voz — Regras para o Claude

App separado de propósito (repo/GitHub Pages próprios), só com a tela de criar um
compromisso por voz (ditado) — pensado pra ser instalado na Tela de Início do iPhone como
atalho independente do app principal (`central-executiva`).

**Por que é um repo separado:** "Adicionar à Tela de Início" numa página dentro do mesmo
escopo de manifest/Service Worker do app principal fazia o iOS tratar o novo atalho como
"mais um ícone do app já instalado" — abria a sessão que já estava aberta (o menu) em vez
de carregar a tela de voz do zero. Um repo/origem de Service Worker diferente evita isso.

**Compartilha dados com o app principal, não é independente nesse sentido:** usa o MESMO
projeto Firebase (`central-executiva-jab`, mesma config pública em `firebase-config.js`) —
como fica no mesmo domínio `joaoibira-ux.github.io` (caminho diferente), o localStorage/
IndexedDB do Firebase Auth é compartilhado automaticamente entre os dois sites. Se o
usuário já está logado no app principal, chega logado aqui também, sem pedir senha de
novo. Salva direto em `usuarios/{uid}/agenda` (mesma coleção do app principal) — o
compromisso criado aqui aparece normalmente na Agenda/Pendências de lá.

**Sem Service Worker de propósito** — é um app pequeno o bastante pra não precisar, e isso
evita toda a classe de bugs de cache/scope que causou o problema original.

**Fluxo de voz (2026-10-19, descoberto que `webkitSpeechRecognition` funciona de verdade
no iPhone do João — ao contrário do que se presumia no app principal)**: sem caixa de
texto nenhuma na tela — só o microfone pulsando + legenda do que está sendo dito.
`ouvirFala()` liga o reconhecimento pra uma etapa; o `onend` (parou de falar) decide o
resultado e já avança sozinho sem nenhum toque: Título → Data (interpretada por
`interpretarDataFalada`) → Hora (`interpretarHoraFalada`, pode ficar em silêncio pra
pular) → salva → mostra "✅ Salvo" por 2s → volta a ouvir o título do próximo, em loop,
sem fim. Se não ouvir nada no título, tenta de novo sozinho (até 5x antes de avisar).
Se o dispositivo não suportar `SpeechRecognition` (`TEM_RECONHECIMENTO_DE_VOZ` falso),
cai no fallback antigo: campos de texto visíveis, dita pelo microfone do teclado do iOS,
avança no Enter/"próximo" do teclado — mesmo fim (salva, 2s, volta a ouvir).

**Atalho de voz pra Pendências (2026-10-21):** se a palavra "pendência(s)" aparecer no
início OU no fim da frase ditada ("pendências comprar açúcar" ou "comprar açúcar
pendências"), `extrairPendencia()` reconhece e o restante da frase (com a primeira letra
maiúscula) vai direto pra Pendências — salva na mesma coleção `agenda`, mas com
`data: ""` (é assim que Pendências já se distingue da Agenda no app principal: item sem
data), via `salvarPendencia()`.

**Hora padrão quando não é dita (2026-10-23):** em `extrairDataHoraDoTitulo()`, se a frase
tem data reconhecida mas nenhuma hora, o padrão é: data = hoje → hora atual + 5 minutos
(`horaAtualMais5min()`, pra já funcionar como próximo alarme); data = qualquer dia futuro →
`07:00` fixo. Comparação feita com `isoDeHoje()` (mesma lógica de zerar as horas e converter
com `toISOString().slice(0,10)` já usada dentro de `interpretarDataFalada`, pra ficar
consistente com o mesmo viés de fuso horário).

**Título sozinho também já conclui, sem perguntar a data (2026-10-23):** as funções
`ouvirData()`/`ouvirHora()` do fluxo em 3 etapas foram REMOVIDAS. Se o título ditado não
tiver nem "pendência(s)" explícito nem data embutida reconhecível (`extrairPendencia()` e
`extrairDataHoraDoTitulo()` ambos retornam `null`), em vez de perguntar a data em seguida,
`ouvirTitulo()` já chama `salvarPendencia()` direto com o próprio texto dito como título —
mesmo destino de um compromisso sem data. Na prática, todo compromisso criado por este app
acaba em um destes dois caminhos a partir de uma única frase: Pendências (sem data nem hora
mencionada, com ou sem a palavra "pendências") ou Agenda com data+hora (quando a data — e
opcionalmente a hora — é reconhecida na própria frase) — não existe mais pergunta de
acompanhamento alguma.

**Tudo numa frase só (2026-10-21):** se o usuário já dita o título com data (e opcionalmente
hora) embutidos — ex: "teste 01 hoje às 15 horas" — `extrairDataHoraDoTitulo()` acha o
primeiro marcador de data na frase (hoje/amanhã/dia da semana/"dia N"/data numérica), usa o
que vem antes como título, e procura um marcador de hora no restante pra separar data de
hora. Se conseguir interpretar a data, salva direto via `salvarTudoDeUmaVez()`. Se não achar
nenhum marcador de data na frase, ou achar um trecho de hora que não dá pra interpretar,
retorna `null` e quem chamou trata o texto como só o título (vai pra Pendências).

**Tentativa de fechar o app sozinho — REVERTIDA, confirmada impossível (2026-10-21 →
2026-10-23):** depois de salvar (por Pendências ou por "tudo numa frase"), chegou a chamar
`window.close()` esperando sair do app automaticamente. **Testado no iPhone real e
confirmado que não funciona**: o app ficava "enganchado" na tela de confirmação, só saía
com o usuário forçando o fechamento manual pelo seletor de apps — e isso, por sua vez, fazia
o Safari perder a permissão do microfone e pedir autorização de novo na próxima abertura
(ciclo ruim: salvar → travar → forçar fechar → perder permissão → autorizar de novo).
**Comportamento atual, definitivo:** depois de qualquer salvamento (Pendências ou com
data/hora), mostra "✅ Salvo" por 2s e **volta a ouvir o título do próximo**
(`setTimeout(() => ouvirTitulo(false), 2000)`), em loop sem fim — igual ao comportamento
original de antes dessas tentativas. O usuário fecha o app manualmente (swipe) quando
quiser, a qualquer momento; o app nunca fica travado esperando um fechamento que não
acontece sozinho.

**Mesmo toque autoriza o microfone — evolução até a versão atual (2026-10-21 →
2026-10-23):**
1. 1ª tentativa: chamava `ouvirTitulo()` automaticamente na carga da página (sem esperar
   login). Não funcionou: abrir o app pelo ícone não conta como gesto de usuário pro
   Safari, que bloqueava `SpeechRecognition.start()` silenciosamente.
2. 2ª tentativa: tela fixa "Toque para falar" que só chamava `ouvirTitulo()` dentro de um
   `click` no `document`, e depois de salvar usava `setTimeout(() => ouvirTitulo(false),
   2000)` pra retomar o loop sozinho. Essa 2ª parte não funcionou: o Safari exige um toque
   real pra CADA chamada de `rec.start()`, não só a primeira da sessão — então, depois de
   salvar o primeiro compromisso, o app ficava com a aparência de preso na tela "✅ Salvo"
   (na prática `ouvirTitulo()` era chamado pelo `setTimeout`, mas falhava silenciosamente
   de novo por falta de gesto, numa recursão rápida que nunca chegava a repintar a tela).
3. **Versão atual:** não existe mais distinção entre "primeira tentativa automática" e as
   seguintes — `ouvirTitulo()` (sem parâmetro) sempre passa `mostrarTelaDeToque` como 3º
   argumento (`aoFalharSemComecar`) pra `ouvirFala()`. Toda vez — na carga da página E
   depois de cada salvamento via `setTimeout(ouvirTitulo, 2000)` — tenta ouvir sozinho
   primeiro; se o Safari bloquear (o evento `onstart` nunca dispara), cai em
   `mostrarTelaDeToque()` (mostra "Toque para falar/continuar" e arma um `click` único que
   chama `ouvirTitulo()` de novo, já dentro de um gesto real). Na prática, isso significa
   que CADA compromisso criado em sequência pode pedir mais um toque — não só o primeiro
   — dependendo de o Safari exigir gesto a cada chamada ou não nesse aparelho. O diálogo
   nativo de autorização do microfone em si só deve aparecer na primeira vez que o site
   pede a permissão — depois fica concedida permanentemente para esse app/origem; é a
   trava de "gesto de usuário" (sem diálogo nenhum, só bloqueio silencioso) que se repete.

O `uid` continua só sendo necessário no fim (dentro de `salvarPendencia`/
`salvarTudoDeUmaVez`, antes de salvar), via `await prontoAuth` — uma Promise resolvida pelo `onAuthStateChanged` com o uid (ou
`null`), que roda em paralelo desde a carga da página, independente do toque. O fallback
de teclado (sem reconhecimento de voz) não tem esse problema de gesto, então continua
simplesmente esperando o `onAuthStateChanged` normalmente antes de começar.

**Versionamento:** este app não segue o padrão de versão obrigatória dos outros sistemas do
João (é pequeno demais, sem Service Worker pra forçar atualização) — mudanças só precisam
de commit + push, o GitHub Pages atualiza sozinho.
