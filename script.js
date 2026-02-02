// ================================
// EIXOS RPM × MAP
// ================================

const RPM_START = 800;
const RPM_END = 8000;
const RPM_STEP = 400;

const MAP_START = -1.0;
const MAP_END = 3.0;
const MAP_STEP = 0.2;

// ================================
// CONFIGURAÇÃO DO CARRO (INPUT)
// ================================

const carro = {
  potenciaBase: 300, // hp original
  aspirado: false,
  fueltech: true,

  combustivel: "alcool", // alcool | gasolina | diesel

  cabecote: "arrombado", // polido | arrombado
  comando: "medio", // baixo | medio | graduado
  coldAir: true,

  pistao: "forjado_taxado", // original | forjado_taxado | forjado_normal | forjado_destaxado
  biela: "forjada", // original | forjada

  turbina: "50/48", // null se aspirado
  nitro: 0 // 0 | 1 | 2
};

// ================================
// TABELAS DE GANHO
// ================================

const ganhos = {
  cabecote: {
    polido: { potencia: 0.10, temp: 0 },
    arrombado: { potencia: 0.30, temp: 0.25 }
  },
  comando: {
    baixo: rpm => rpm < 4000 ? 0.25 : 0,
    medio: rpm => rpm >= 3000 ? 0.25 : 0,
    graduado: rpm => rpm >= 5000 ? 0.80 : 0
  },
  pistao: {
    original: { resistencia: 0.50, potencia: 0 },
    forjado_taxado: { resistencia: 1.30, potencia: 0.35 },
    forjado_normal: { resistencia: 1.50, potencia: 0 },
    forjado_destaxado: { resistencia: 1.70, potencia: -0.20 }
  },
  biela: {
    original: 1.0,
    forjada: 2.0
  },
  turbinaLimite: {
    "42/36": 1.2,
    "42/48": 1.5,
    "50/36": 1.7,
    "50/48": 2.0,
    "50/63": 2.6,
    "70/63": 2.8,
    "70/70": 3.5,
    "70/84": 4.0
  }
};

// ================================
// CÁLCULO POTÊNCIA E RESISTÊNCIA
// ================================

function calcularPotencia(rpm) {
  let pot = carro.potenciaBase;

  pot += pot * ganhos.cabecote[carro.cabecote].potencia;
  pot += pot * ganhos.comando[carro.comando](rpm);

  if (carro.coldAir) pot += pot * 0.05;
  pot += pot * ganhos.pistao[carro.pistao].potencia;

  if (carro.nitro === 1) pot *= 2;
  if (carro.nitro === 2) pot *= 2;

  if (carro.fueltech) pot *= 1.10;

  return pot;
}

function calcularResistencia() {
  let resistencia = ganhos.pistao[carro.pistao].resistencia;

  resistencia = Math.min(resistencia, ganhos.biela[carro.biela]);

  if (carro.fueltech) resistencia *= 1.40;

  return resistencia;
}

// ================================
// MISTURA
// ================================

function calcularMistura(rpm, map) {
  let mistura;

  if (carro.combustivel === "alcool") {
    mistura = map > 0 ? 0.82 : 0.84;
  } else {
    mistura = map > 0 ? 0.90 : 0.92;
  }

  mistura += rpm * 0.00001;

  return Number(mistura.toFixed(2));
}

// ================================
// IGNIÇÃO
// ================================

function calcularAvanco(rpm, map) {
  let avanco;

  if (rpm < 3000) avanco = 15;
  else if (rpm < 5000) avanco = 30;
  else avanco = 40;

  if (map >= 1) avanco = 28;
  if (map >= 2) avanco = 24;
  if (map >= 3) avanco = 20;

  if (carro.combustivel === "alcool") avanco += 2;

  return avanco;
}

// ================================
// RISCO DE QUEBRA
// ================================

function calcularRisco(rpm, map, avanco, potencia) {
  let risco = 0;

  const resistencia = calcularResistencia();
  const limiteTurbo = ganhos.turbinaLimite[carro.turbina] || 0;

  if (map > limiteTurbo) risco += 40;
  if (rpm > 6500) risco += 20;
  if (avanco > 35 && map > 0) risco += 25;

  const ganhoPercentual = (potencia / carro.potenciaBase) - 1;
  const limiteMotor = resistencia;

  if (ganhoPercentual > limiteMotor) risco += 50;

  if (carro.combustivel === "alcool") risco += 10;
  if (carro.combustivel === "gasolina") risco += 5;

  return Math.min(risco, 100);
}

// ================================
// TABELA RPM × MAP
// ================================

function gerarTabela() {
  const tabela = [];

  for (let rpm = RPM_START; rpm <= RPM_END; rpm += RPM_STEP) {
    for (let map = MAP_START; map <= MAP_END + 0.001; map += MAP_STEP) {
      const mistura = calcularMistura(rpm, map);
      const avanco = calcularAvanco(rpm, map);
      const potencia = calcularPotencia(rpm);
      const risco = calcularRisco(rpm, map, avanco, potencia);

      tabela.push({
        rpm,
        map: Number(map.toFixed(1)),
        mistura,
        avanco,
        potencia: Math.round(potencia),
        risco
      });
    }
  }

  return tabela;
}

// ================================
// EXPORTAR CSV
// ================================

function exportarCSV() {
  const tabela = gerarTabela();
  let csv = "RPM,MAP,MISTURA,AVANCO,POTENCIA,RISCO\n";

  tabela.forEach(l => {
    csv += `${l.rpm},${l.map},${l.mistura},${l.avanco},${l.potencia},${l.risco}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "fueltech_gta_brasilia_rp.csv";
  link.click();
}
