# Créditos e licenças dos assets

Jogo **NICOLAS.EXE — Birthday Build**, feito por **Thomas Rangel Bugs**.

Todos os áudios de terceiros abaixo são **CC0** (domínio público / uso livre, inclusive em jogos). Atribuição não é obrigatória, mas é feita aqui com carinho.

## Música

| Arquivo no projeto | Nome original | Autor | Origem | Licença |
| --- | --- | --- | --- | --- |
| `assets/audio/music/menu.ogg` | Techno_Chiptale | Centurion_of_war | [OpenGameArt](https://opengameart.org/content/technochiptale) | CC0 |
| `assets/audio/music/level1.mp3` | tEcHNo gEeK | mrpoly | [OpenGameArt](https://opengameart.org/content/techno-geek) | CC0 |
| `assets/audio/music/level2.ogg` | Synthwave House Loop | Fupi | [OpenGameArt](https://opengameart.org/content/synthwave-house-loop) | CC0 |
| `assets/audio/music/level3.mp3` | Cyberpunk Beauty | Tarush Singhal | [OpenGameArt](https://opengameart.org/content/cyberpunk-beauty) | CC0 |
| `assets/audio/music/level4.mp3` | Dark City | cinameng | [OpenGameArt](https://opengameart.org/content/dark-city-0) | CC0 |
| `assets/audio/music/boss.ogg` | Last One Standing (5) | Centurion_of_war | [OpenGameArt](https://opengameart.org/content/last-one-standing) | CC0 |
| `assets/audio/music/boss_final.ogg` | Last One Standing (6) | Centurion_of_war | [OpenGameArt](https://opengameart.org/content/last-one-standing) | CC0 |
| `assets/audio/music/ending.mp3` | Corrupt Data Stream | Tsorthan Grove | [OpenGameArt](https://opengameart.org/content/corrupt-data-stream) | CC0 |
| `assets/audio/music/victory.ogg` | NES jingle 12 | Kenney | [OpenGameArt / Kenney.nl](https://opengameart.org/content/85-short-music-jingles) | CC0 |
| `assets/audio/music/intro.wav` | Loop original do projeto | Birthday Build tools | gerado em `tools/generate_audio.py` | original / livre |
| `assets/audio/music/ending_soft.wav` | Loop original (ending suave) | Birthday Build tools | gerado em `tools/generate_audio.py` | original / livre |

## Efeitos sonoros

| Pacote | Autor | Origem | Licença | Uso no jogo |
| --- | --- | --- | --- | --- |
| Digital SFX Set (lasers, zaps, power-ups) | Kenney | [OpenGameArt](https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc) | CC0 | jump, land, shoot, hurt, pickup, transition, impact |
| Interface Sounds | Kenney | [OpenGameArt](https://opengameart.org/content/interface-sounds) · [Kenney.nl](https://kenney.nl/assets/interface-sounds) | CC0 | click, hover, select, pause, glitch, checkpoint, death, game over, achievement |
| Sci-Fi Sounds | Kenney | [OpenGameArt](https://opengameart.org/content/sci-fi-sounds) · [Kenney.nl](https://kenney.nl/assets/sci-fi-sounds) | CC0 | attack, hit, explosion, boss shot, enemy death, special |
| 85 Short music jingles | Kenney | [OpenGameArt](https://opengameart.org/content/85-short-music-jingles) | CC0 | victory sting |

Arquivos renomeados em `assets/audio/sfx/` (ex.: `jump.mp3`, `click.ogg`) são cópias desses pacotes, sem alteração de autoria.

## Fontes (SIL Open Font License)

| Fonte | Arquivo | Origem |
| --- | --- | --- |
| Press Start 2P | `assets/fonts/PressStart2P-Regular.ttf` | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/pressstart2p) |
| VT323 | `assets/fonts/VT323-Regular.ttf` | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/vt323) |
| Share Tech Mono | `assets/fonts/ShareTechMono-Regular.ttf` | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/sharetechmono) |
| Orbitron | `assets/fonts/Orbitron-Bold.ttf` | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/orbitron) |

## Arte visual

| Asset | Origem | Observação |
| --- | --- | --- |
| `assets/art/*.png` | arte gerada para este presente | fundos, interlúdios (Nicolas digitando após cada fase) e ending de 24 anos |
| `assets/sprites/**/*.png` | gerados em `tools/generate_sprites.py` | PNG com canal alpha, pixel art cyber |
| `assets/ui/*.png` | gerados no mesmo script | painéis, botões, barras |
| `assets/sprites/portraits/*` | retrato estilizado + moldura neon | **não** é recorte da foto do Nicolas |
| `assets/art/enemy_syntax_concept.png` | conceito visual | não usado como sprite jogável |

O protagonista (cabelo cacheado, bigode, jaqueta de couro preta, neon ciano) foi desenhado em pixel art a partir da foto de referência em `/reference`. A foto **não** entra como textura jogável.

## Motor

Phaser 3.90.0 incluído localmente em `vendor/` (licença MIT) — [https://phaser.io](https://phaser.io)

## Mixkit / músicas comerciais

**Não utilizadas.** A licença de música do Mixkit não cobre jogos; por isso as trilhas vieram do OpenGameArt (CC0) e de loops originais do projeto.


## Sprites da edição revisada

`assets/sprites/enemies/*/atlas.png` e `assets/sprites/bosses/*/atlas.png`: artes originais geradas para este projeto pela ferramenta de geração de imagens integrada. Seis inimigos e três chefes, cada um com quatro poses. As folhas foram recortadas, redimensionadas e empacotadas como PNG RGBA; a transparência gerada foi preservada. Os prompts completos estão em `SPRITE_PROMPTS.md`.

## Passe visual 2

`assets/sprites/player/*.png`: o concept de corpo inteiro do Nicolas (cabelo cacheado, bigode/barba, jaqueta preta com detalhes ciano) foi limpo para RGBA, rasterizado em folhas de 96×128 e recebeu variações de movimento, ataque, dano e morte. `assets/sprites/tiles/*`, `assets/sprites/items/*` e os fundos de fase receberam um acabamento local determinístico de metal, luz e profundidade para manter o estilo cyberpunk dos inimigos sem depender de CDN ou de geração em tempo de execução.
