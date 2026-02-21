const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hud = {
  health: document.getElementById('healthValue'),
  shield: document.getElementById('shieldValue'),
  mats: document.getElementById('materialsValue'),
  kills: document.getElementById('killsValue'),
  storm: document.getElementById('stormTimerValue')
};

const keys = new Set();
const mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };

const state = {
  running: true,
  kills: 0,
  stormTimer: 20,
  safeRadius: 420,
  nextShrink: 20,
  bullets: [],
  enemyBullets: [],
  enemies: [],
  walls: []
};

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 14,
  speed: 220,
  health: 100,
  shield: 50,
  materials: 30,
  fireCooldown: 0
};

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  const margin = 30;
  let x = 0;
  let y = 0;

  if (side === 0) {
    x = Math.random() * canvas.width;
    y = -margin;
  } else if (side === 1) {
    x = canvas.width + margin;
    y = Math.random() * canvas.height;
  } else if (side === 2) {
    x = Math.random() * canvas.width;
    y = canvas.height + margin;
  } else {
    x = -margin;
    y = Math.random() * canvas.height;
  }

  state.enemies.push({
    x,
    y,
    radius: 12,
    hp: 55,
    speed: 85 + Math.random() * 55,
    fireCooldown: 0.5 + Math.random() * 1.2
  });
}

for (let i = 0; i < 6; i += 1) {
  spawnEnemy();
}

function normalize(x, y) {
  const mag = Math.hypot(x, y) || 1;
  return { x: x / mag, y: y / mag };
}

function shoot(fromX, fromY, toX, toY, speed, collection, damage) {
  const dir = normalize(toX - fromX, toY - fromY);
  collection.push({
    x: fromX,
    y: fromY,
    vx: dir.x * speed,
    vy: dir.y * speed,
    life: 1.4,
    damage,
    radius: 3
  });
}

function placeWall() {
  if (player.materials < 5) return;

  const dir = normalize(mouse.x - player.x, mouse.y - player.y);
  const distance = 42;
  const wallX = player.x + dir.x * distance;
  const wallY = player.y + dir.y * distance;

  state.walls.push({
    x: wallX,
    y: wallY,
    width: 48,
    height: 16,
    hp: 80,
    life: 12,
    rotation: Math.atan2(dir.y, dir.x)
  });
  player.materials -= 5;
}

function applyDamage(target, amount) {
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, amount);
    target.shield -= absorbed;
    amount -= absorbed;
  }
  target.health -= amount;
}

function circleContains(entityX, entityY) {
  return Math.hypot(entityX - canvas.width / 2, entityY - canvas.height / 2) <= state.safeRadius;
}

function update(dt) {
  if (!state.running) return;

  state.stormTimer -= dt;
  if (state.stormTimer <= 0) {
    state.safeRadius = Math.max(130, state.safeRadius - 65);
    state.stormTimer = Math.max(8, state.nextShrink - 3);
    state.nextShrink = state.stormTimer;
  }

  let moveX = 0;
  let moveY = 0;
  if (keys.has('w')) moveY -= 1;
  if (keys.has('s')) moveY += 1;
  if (keys.has('a')) moveX -= 1;
  if (keys.has('d')) moveX += 1;

  const moveDir = normalize(moveX, moveY);
  player.x += moveDir.x * player.speed * dt;
  player.y += moveDir.y * player.speed * dt;
  player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

  player.fireCooldown -= dt;
  if (mouse.down && player.fireCooldown <= 0) {
    shoot(player.x, player.y, mouse.x, mouse.y, 520, state.bullets, 25);
    player.fireCooldown = 0.15;
  }

  if (!circleContains(player.x, player.y)) {
    applyDamage(player, 12 * dt);
  }

  state.walls = state.walls.filter((wall) => {
    wall.life -= dt;
    return wall.hp > 0 && wall.life > 0;
  });

  state.bullets = state.bullets.filter((bullet) => {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    for (const enemy of state.enemies) {
      if (Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) <= enemy.radius + bullet.radius) {
        enemy.hp -= bullet.damage;
        bullet.life = -1;
        break;
      }
    }

    return bullet.life > 0;
  });

  state.enemyBullets = state.enemyBullets.filter((bullet) => {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    for (const wall of state.walls) {
      const dx = Math.abs(bullet.x - wall.x);
      const dy = Math.abs(bullet.y - wall.y);
      if (dx <= wall.width / 2 && dy <= wall.height / 2) {
        wall.hp -= bullet.damage;
        bullet.life = -1;
        return false;
      }
    }

    if (Math.hypot(player.x - bullet.x, player.y - bullet.y) <= player.radius + bullet.radius) {
      applyDamage(player, bullet.damage);
      return false;
    }

    return bullet.life > 0;
  });

  state.enemies = state.enemies.filter((enemy) => {
    if (enemy.hp <= 0) {
      state.kills += 1;
      player.materials = Math.min(99, player.materials + 4);
      spawnEnemy();
      return false;
    }

    const dir = normalize(player.x - enemy.x, player.y - enemy.y);
    enemy.x += dir.x * enemy.speed * dt;
    enemy.y += dir.y * enemy.speed * dt;

    enemy.fireCooldown -= dt;
    if (enemy.fireCooldown <= 0) {
      shoot(enemy.x, enemy.y, player.x, player.y, 340, state.enemyBullets, 15);
      enemy.fireCooldown = 0.9 + Math.random() * 0.8;
    }

    if (!circleContains(enemy.x, enemy.y)) {
      enemy.hp -= 8 * dt;
    }

    if (Math.hypot(enemy.x - player.x, enemy.y - player.y) <= enemy.radius + player.radius) {
      applyDamage(player, 25 * dt);
    }

    return true;
  });

  if (player.health <= 0) {
    state.running = false;
  }

  hud.health.textContent = Math.max(0, Math.ceil(player.health));
  hud.shield.textContent = Math.max(0, Math.ceil(player.shield));
  hud.mats.textContent = player.materials;
  hud.kills.textContent = state.kills;
  hud.storm.textContent = Math.ceil(state.stormTimer);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
  ctx.lineWidth = 120;
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, state.safeRadius + 60, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, state.safeRadius, 0, Math.PI * 2);
  ctx.stroke();

  for (const wall of state.walls) {
    ctx.save();
    ctx.translate(wall.x, wall.y);
    ctx.rotate(wall.rotation);
    ctx.fillStyle = '#c084fc';
    ctx.fillRect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);
    ctx.restore();
  }

  ctx.fillStyle = '#f8fafc';
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#fb7185';
  for (const bullet of state.enemyBullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of state.enemies) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.fillRect(enemy.x - 16, enemy.y - 22, 32, 5);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(enemy.x - 16, enemy.y - 22, (enemy.hp / 55) * 32, 5);
  }

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  const aim = normalize(mouse.x - player.x, mouse.y - player.y);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + aim.x * 22, player.y + aim.y * 22);
  ctx.stroke();

  if (!state.running) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px Inter, sans-serif';
    ctx.fillText('You were eliminated', canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '24px Inter, sans-serif';
    ctx.fillText(`Eliminations: ${state.kills}`, canvas.width / 2, canvas.height / 2 + 24);
  }
}

let previous = performance.now();
function gameLoop(now) {
  const dt = Math.min(0.033, (now - previous) / 1000);
  previous = now;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);

window.addEventListener('keydown', (event) => {
  keys.add(event.key.toLowerCase());
  if (event.code === 'Space') {
    event.preventDefault();
    placeWall();
  }
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
});

canvas.addEventListener('mousedown', () => {
  mouse.down = true;
});

window.addEventListener('mouseup', () => {
  mouse.down = false;
});
