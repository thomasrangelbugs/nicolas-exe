# NICOLAS.EXE — Birthday Build · edição revisada

Jogo de aniversário para Nicolas, por Thomas Rangel Bugs. Campanha de quatro fases com prólogo, seis tipos de inimigos, três chefes, cenas de história e final de aniversário.

## Jogar / publicar no Netlify

O pacote é um site estático completo. Não precisa instalar dependências nem executar build para publicar.

1. Extraia o ZIP.
2. No Netlify, use **Deploy manually** e arraste a pasta que contém `index.html`, `src`, `assets` e `vendor`.
3. Em um projeto conectado por Git: diretório de publicação `.` e comando de build vazio.

O motor Phaser 3.90.0 está incluído em `vendor/`; a partida não depende de uma CDN. Fontes, artes e áudios também são locais.

Para testar no computador, abra um terminal na pasta e execute:

```bash
python -m http.server 8080
```

Acesse `http://localhost:8080`. Não abra `index.html` diretamente por `file://`, pois o jogo usa módulos JavaScript.

## Campanha

1. **Hello World:** elimine os bugs e recupere o primeiro fragmento.
2. **Deadline Valley:** elimine os bugs e derrote Procrastination.
3. **Production:** elimine os bugs e derrote Deadline.
4. **Legacy Code:** vença o Ultimate Bug e restaure a Birthday Build.

Em todas as fases, o portal no extremo direito acende depois dos combates. Atravesse-o no chão para terminar a fase. Leia a cena da história e aperte **Enter** ou o botão para avançar. O final apresenta a mensagem de aniversário, o resultado da campanha e as opções de jogar novamente ou voltar ao menu.

## Controles

| Tecla | Ação |
|---|---|
| A / D ou ← / → | Mover |
| W / Espaço / ↑ | Pular; solte e aperte novamente no ar para pulo duplo |
| E | Toque e solte para atirar; segure e solte para tiro carregado |
| Shift | Correr, gastando cafeína |
| F / S / ↓ | Defender, gastando cafeína |
| Esc | Pausar / continuar |
| M | Ativar / desativar som |
| Enter | Iniciar missão / avançar a história / voltar do final |

No celular: direcional, **B pulo**, **A ataque**, **Y corrida**, **X defesa**. A melhor área de jogo fica na horizontal; também é possível jogar na vertical. Segurar A carrega o tiro. Os controles ficam fora do cenário.

## Progresso e tentativas

- Checkpoints Git restauram Nicolas no ponto alcançado durante a fase.
- Ao morrer, Nicolas retorna com vida cheia, cafeína mínima e um breve período de proteção. Os inimigos já derrotados continuam derrotados.
- **Continuar** retoma no início da fase atual. Fechar/recarregar a página não preserva o checkpoint dentro da fase.
- **Nova aventura** reinicia a campanha e seu placar; mantém as conquistas e os totais históricos.
- O progresso é salvo neste navegador. Se o armazenamento estiver bloqueado, o jogo continua funcionando, mas o progresso dura apenas enquanto a página permanecer aberta.

## Arquivos editáveis

Todo o código-fonte está em `src/`. As artes dos inimigos estão em `assets/sprites/enemies/<tipo>/atlas.png` (4 quadros de 128×128); chefes em `assets/sprites/bosses/<nome>/atlas.png` (4 quadros de 256×256). O protagonista usa folhas RGBA de 96×128 com idle, caminhada/corrida em 10 frames, pulo, ataque, dano e morte.

Consulte `ALTERACOES.md`, `TESTES.md` e `assets/sprites/manifest.json`. O passe visual 2 também está documentado em `tools/rebuild_assets_v2.cjs`; os scripts antigos em `tools/` são históricos e não devem ser usados para regenerar os sprites atuais.

## Testes automatizados

O navegador de testes precisa de Node e Playwright. Instale-os somente se quiser executar a suíte de desenvolvimento:

```bash
npm install --no-save playwright
npx playwright install chromium
node tests/run-tests.cjs
```

Opcionalmente, `TEST_CHROME` aponta para um Chromium já instalado. A suíte serve o jogo localmente e grava resultados em `qa/`. A instrumentação é ativada somente em localhost com `?test=1`; não está ativa no jogo publicado.

## Créditos

Artes de inimigos e chefes criadas com geração de imagens para esta revisão. As músicas, efeitos, fontes e artes originais foram preservados; seus créditos estão em `ASSETS_CREDITS.md`.
