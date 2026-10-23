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
data). Diferente do fluxo normal, depois de salvar NÃO volta a ouvir o título do próximo:
mostra o aviso "Salvo em Pendências" e chama `tentarFecharApp()`.

**Título sozinho também já conclui, sem perguntar a data (2026-10-23):** as funções
`ouvirData()`/`ouvirHora()` do fluxo em 3 etapas foram REMOVIDAS. Se o título ditado não
tiver nem "pendência(s)" explícito nem data embutida reconhecível (`extrairPendencia()` e
`extrairDataHoraDoTitulo()` ambos retornam `null`), em vez de perguntar a data em seguida,
`ouvirTitulo()` já chama `salvarPendenciaEFechar()` direto com o próprio texto dito como
título — mesmo destino de um compromisso sem data (Pendências) e mesmo comportamento de
tentar fechar o app depois. Na prática, todo compromisso criado por este app acaba em um
destes 3 caminhos a partir de uma única frase: Pendências (sem data nem hora mencionada,
com ou sem a palavra "pendências"), Agenda com data+hora (quando ambas são reconhecidas na
própria frase), ou, se a extração falhar de forma inesperada, cai no mesmo salvamento em
Pendências — não existe mais pergunta de acompanhamento alguma.

**Dizer tudo numa frase também fecha o app (2026-10-21):** quando `extrairDataHoraDoTitulo()`
reconhece título+data(+hora) numa frase só e salva direto (`salvarTudoDeUmaVez()`), também
NÃO volta a ouvir o título do próximo — mostra o aviso de salvo e chama `tentarFecharApp()`,
igual ao caso de Pendências. Só o fluxo em 3 etapas separadas (dita só o título, depois só a
data, depois só a hora) continua em loop depois de salvar, voltando a ouvir o título
seguinte — é o único jeito de criar vários compromissos em sequência sem reabrir o app.
**Limitação conhecida:** iOS normalmente bloqueia `window.close()` em apps adicionados à
Tela de Início (só funciona de verdade em abas abertas via script) — por isso o aviso de
salvo fica fixo na tela como fallback visual caso o fechamento automático não funcione
nesse aparelho.

**Tudo numa frase só (2026-10-21):** se o usuário já dita o título com data (e opcionalmente
hora) embutidos — ex: "teste 01 hoje às 15 horas" — `extrairDataHoraDoTitulo()` acha o
primeiro marcador de data na frase (hoje/amanhã/dia da semana/"dia N"/data numérica), usa o
que vem antes como título, e procura um marcador de hora no restante pra separar data de
hora. Se conseguir interpretar a data (e a hora, se houver uma palavra de hora presente),
salva direto via `salvarTudoDeUmaVez()` sem passar pelas etapas de Data/Hora. Se não achar
nenhum marcador de data na frase, ou achar um trecho de hora que não dá pra interpretar,
retorna `null` e o fluxo normal segue (pergunta Data, depois Hora, em etapas separadas).

**Mesmo toque autoriza o microfone — tentativa revertida, substituída por "Toque para
falar" (2026-10-21→2026-10-23):** a primeira versão chamava `ouvirTitulo()`
automaticamente na carga da página (sem esperar login), na esperança de a permissão do
microfone aparecer colada ao toque no ícone da Tela de Início. **Não funcionou**: o
Safari/iOS só libera `SpeechRecognition.start()` dentro de um toque real DENTRO da
página — abrir o app pelo ícone (fora do contexto JS da página carregada) não conta como
esse gesto, então `rec.start()` ficava bloqueado silenciosamente e o app nunca escutava de
verdade até um toque manual na tela. **Solução atual:** mostra uma tela "Toque para
falar" ao carregar e só chama `ouvirTitulo()` dentro de um listener de `click` no
`document` (`{ once: true }`) — ou seja, ainda é preciso 1 toque dentro do app depois de
abri-lo (isso é uma política do navegador, não um bug), mas agora fica claro e imediato em
vez de parecer travado na tela de "ouvindo" sem fazer nada. O `uid` continua só sendo
necessário no fim (dentro de `ouvirHora`, antes de salvar), via `await prontoAuth` — uma
Promise resolvida pelo `onAuthStateChanged` com o uid (ou `null`), que roda em paralelo
desde a carga da página independente do toque. O fallback de teclado (sem reconhecimento
de voz) não tem esse problema de gesto, então continua simplesmente esperando o
`onAuthStateChanged` normalmente antes de começar.

**Versionamento:** este app não segue o padrão de versão obrigatória dos outros sistemas do
João (é pequeno demais, sem Service Worker pra forçar atualização) — mudanças só precisam
de commit + push, o GitHub Pages atualiza sozinho.
