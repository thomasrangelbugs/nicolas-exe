/** Bug archive shown after the ending and from the menu (when completed). */
export const BESTIARY = [
  {
    id: 'syntax',
    name: 'SYNTAX',
    kind: 'BUG',
    texture: 'en_syntax',
    anim: 'en-syntax-idle',
    accent: '#6ee7ff',
    blurb: 'Atirador de média distância. Mantém espaço, solta linhas na horizontal e de vez em quando dá uma corrida pra te assustar.',
    tip: 'Não encosta. Desvia do tiro e responde com carga.'
  },
  {
    id: 'runtime',
    name: 'RUNTIME',
    kind: 'BUG',
    texture: 'en_runtime',
    anim: 'en-runtime-idle',
    accent: '#ff7c55',
    blurb: 'Caçador corpo a corpo. Não atira — corre, investe e aperta no tapa. Menos HP, mais pressão.',
    tip: 'Não deixe fechar a distância. Pulo + tiro carregado.'
  },
  {
    id: 'null',
    name: 'NULL POINTER',
    kind: 'BUG',
    texture: 'en_null',
    anim: 'en-null-idle',
    accent: '#bba2ff',
    blurb: 'Teleporta bem perto e só bate no corpo a corpo. Sem tiro — o susto é aparecer no seu ombro e investir.',
    tip: 'Quando sumir, prepare o pulo ou a defesa. Ele volta colado.'
  },
  {
    id: 'leak',
    name: 'MEMORY LEAK',
    kind: 'BUG',
    texture: 'en_leak',
    anim: 'en-leak-idle',
    accent: '#47e899',
    blurb: 'Só nas plataformas flutuantes. Chove verde pra baixo e às vezes dispara na beira pra te pressionar.',
    tip: 'Sobe nele ou desvia do arco. Verde no chão = perigo.'
  },
  {
    id: 'legacy',
    name: 'LEGACY',
    kind: 'BUG',
    texture: 'en_legacy',
    anim: 'en-legacy-idle',
    accent: '#d7b464',
    blurb: 'Tanque lento, barra longa, parafusos pesados. De raro em raro faz um avanço de stomp.',
    tip: 'Tiro fraco só cospe. Carrega a energia e delete de vez.'
  },
  {
    id: 'spaghetti',
    name: 'SPAGHETTI',
    kind: 'BUG',
    texture: 'en_spaghetti',
    anim: 'en-spaghetti-idle',
    accent: '#ff6b9d',
    blurb: 'Zig-zag caótico, rajada em leque torto e dash de pânico. Dependência cruzada em forma de monstro.',
    tip: 'Não tente prever. Mire no centro e mantenha distância.'
  },
  {
    id: 'procrastination',
    name: 'PROCRASTINATION',
    kind: 'CHEFE',
    texture: 'boss_procrastination',
    anim: 'boss-procrastination-idle',
    accent: '#ff7c55',
    blurb: 'Chefe da fase 2. Atrasa o golpe, solta cone preguiçoso e às vezes decide “ok, vou fazer” com um dash.',
    tip: 'Use a janela depois do ataque. DEADLINE VALLEY.'
  },
  {
    id: 'deadline',
    name: 'DEADLINE',
    kind: 'CHEFE',
    texture: 'boss_deadline',
    anim: 'boss-deadline-idle',
    accent: '#46f0bd',
    blurb: 'Chefe da fase 3. Pressão de relógio: rajadas rápidas, chuva e anel fechando em cima de você.',
    tip: 'PRODUCTION. Plataformas e café — o tempo não espera.'
  },
  {
    id: 'ultimate',
    name: 'THE ULTIMATE BUG',
    kind: 'CHEFE FINAL',
    texture: 'boss_ultimate',
    anim: 'boss-ultimate-idle',
    accent: '#d7b464',
    blurb: 'Chefe final. Mistura cone, burst, chuva e tele-stomp. O bug que sobreviveu a todo commit.',
    tip: 'Quando cair, a Birthday Build sobe. Vale cada café.'
  }
];
