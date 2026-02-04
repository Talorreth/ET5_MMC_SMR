import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Play,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  MapPin,
  Info,
  BarChart as IconBarChart,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react';

import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ReferenceLine,
} from 'recharts';

const API_URL = "http://127.0.0.1:8000";
const BAR_COLORS = ['#22d3ee', '#38bdf8', '#60a5fa', '#a78bfa', '#f59e0b'];
const HARD_NO_GO_CODES = ['GS', 'HG', 'PF', 'LU', 'ER', 'SOC2', 'ENV6', 'GEO2', 'GEO5'];

const fixText = (value) => {
  if (value === null || value === undefined) return '';
  let text = String(value);

  if (text.includes('Ã') || text.includes('Â')) {
    try {
      const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0));
      text = new TextDecoder('utf-8').decode(bytes);
    } catch (error) {
      // Silence: on garde la version originale si l'environnement ne supporte pas TextDecoder.
    }
  }

  const mojibakeFixes = [
    [/Ã©/g, 'é'], [/Ã¨/g, 'è'], [/Ãª/g, 'ê'], [/Ã«/g, 'ë'],
    [/Ã /g, 'à'], [/Ã¢/g, 'â'], [/Ã¤/g, 'ä'],
    [/Ã®/g, 'î'], [/Ã¯/g, 'ï'],
    [/Ã´/g, 'ô'], [/Ã¶/g, 'ö'],
    [/Ã¹/g, 'ù'], [/Ã»/g, 'û'], [/Ã¼/g, 'ü'],
    [/Ã§/g, 'ç'],
    [/â€™/g, '’'], [/â€œ/g, '“'], [/â€/g, '”'], [/â€“/g, '–'], [/â€¦/g, '…'],
    [/Â/g, ''],
  ];

  mojibakeFixes.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  const wordFixes = [
    [/S�ret�/g, 'Sûreté'],
    [/S�curit�/g, 'Sécurité'],
    [/R�silience/g, 'Résilience'],
    [/M�t�orologie/g, 'Météorologie'],
    [/G�ologie/g, 'Géologie'],
    [/G�otechnique/g, 'Géotechnique'],
    [/G�opolitique/g, 'Géopolitique'],
    [/D�chets/g, 'Déchets'],
    [/D�pendance/g, 'Dépendance'],
    [/Maturit�/g, 'Maturité'],
    [/r�glement/g, 'règlement'],
    [/Syst�me/g, 'Système'],
    [/Capacit�/g, 'Capacité'],
    [/Propri�t�/g, 'Propriété'],
    [/cha�ne/g, 'chaîne'],
    [/p�che/g, 'pêche'],
    [/temp�tes/g, 'tempêtes'],
    [/co�ts/g, 'coûts'],
    [/b�timents/g, 'bâtiments'],
    [/�conomie/g, 'Économie'],
    [/�l�vation/g, 'Élévation'],
    [/�colog/g, 'écolog'],
    [/�lector/g, 'élector'],
    [/d��/g, "d'é"],
    [/Ad�quation puissance \? taille r�seau/gi, 'Adéquation puissance / taille réseau'],
  ];

  wordFixes.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  text = text.replace(/d�(?=[aeiouyâàéèêëîïôöûü])/gi, "d'");
  text = text.replace(/l�(?=[aeiouyâàéèêëîïôöûü])/gi, "l'");
  text = text.replace(/\b�le\b/gi, 'île');
  text = text.replace(/\s�\s?l/gi, ' à l');
  text = text.replace(/\s�\s?long/gi, ' à long');
  text = text.replace(/\s�\s?cr/gi, ' à cr');
  text = text.replace(/\s�\s?60/gi, ' à 60');
  text = text.replace(/\sen �le/gi, 'en île');

  if (text.includes('�')) {
    text = text.replace(/�/g, 'é');
  }

  return text;
};

const formatSmrLabel = (value) =>
  fixText(value)
    .replace(/\s\(/g, '\u00A0(')
    .replace(/\s/g, '\u00A0');

const SmrTick = ({ x, y, payload }) => {
  const label = formatSmrLabel(payload?.value ?? '');
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={-8}
        y={0}
        textAnchor="end"
        dominantBaseline="central"
        fill="#a1f5ff"
        fontSize={11}
        fontWeight={500}
      >
        {label}
      </text>
    </g>
  );
};

const BarTrack = ({ x, y, width, height, payload }) => {
  if (payload?.disqualified) return null;
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={10}
      ry={10}
      fill="rgba(15, 23, 42, 0.55)"
    />
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const isDisqualified = payload?.[0]?.payload?.disqualified;
    const reason = payload?.[0]?.payload?.reason;
    return (
      <div className="bg-slate-950/95 p-3 border border-cyan-500/30 shadow-2xl rounded-xl text-xs">
        <p className="font-semibold text-cyan-300 mb-2">{fixText(label)}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="flex items-center gap-2 text-slate-100">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }}></span>
            {fixText(entry.name)}: <span className="font-mono font-bold">{entry.value}</span>
          </p>
        ))}
        {isDisqualified && (
          <p className="mt-2 text-[11px] text-rose-200/80">
            {reason ? fixText(reason) : 'Disqualifié'}
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function SimulationPanel({ island, onClose }) {
  const [loading, setLoading] = useState(false);
  const [criteriaList, setCriteriaList] = useState([]);
  const [scores, setScores] = useState({});
  const [originalScores, setOriginalScores] = useState({});
  const [smrProfiles, setSmrProfiles] = useState({});
  const [baseWeights, setBaseWeights] = useState({});
  const [scenario, setScenario] = useState('classic');
  const [scenarioMenuOpen, setScenarioMenuOpen] = useState(false);
  const [alpha, setAlpha] = useState(0.3);
  const [results, setResults] = useState(null);
  const [selectedSmr, setSelectedSmr] = useState(null);
  const [openTheme, setOpenTheme] = useState(null);

  const getThemeValue = (crit) =>
    fixText(crit['Thématique'] ?? crit.Thematique ?? crit['Thematique'] ?? 'Autre');

  const getCriteriaLabel = (crit) =>
    fixText(crit['Critère'] ?? crit.Critere ?? crit['Critere'] ?? 'Critère');

  const getExplication = (crit) =>
    fixText(crit.Explications ?? crit.Explication ?? '');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [critRes, islandRes, smrRes, weightRes] = await Promise.all([
          axios.get(`${API_URL}/criteria`),
          axios.get(`${API_URL}/islands`, { params: { scenario } }),
          axios.get(`${API_URL}/smrs`),
          axios.get(`${API_URL}/weights`),
        ]);
        setCriteriaList(critRes.data || []);
        setSmrProfiles(smrRes.data || {});
        if (islandRes.data && islandRes.data[island.id]) {
          setScores(islandRes.data[island.id]);
          setOriginalScores(islandRes.data[island.id]);
        }
        if (weightRes.data && weightRes.data[island.id]) {
          setBaseWeights(weightRes.data[island.id]);
        } else {
          setBaseWeights({});
        }
      } catch (error) {
        console.error("Erreur chargement:", error);
      }
    };
    fetchData();
    setResults(null);
    setSelectedSmr(null);
  }, [island.id, scenario]);

  const radarData = useMemo(() => {
    if (!criteriaList.length || !Object.keys(scores).length) return [];
    const themes = {};
    criteriaList.forEach((c) => {
      const themeKey = getThemeValue(c);
      if (!themes[themeKey]) themes[themeKey] = { islandSum: 0, smrSum: 0, count: 0 };
      themes[themeKey].islandSum += scores[c.Code] || 0;
      if (selectedSmr && smrProfiles[selectedSmr]) {
        themes[themeKey].smrSum += smrProfiles[selectedSmr][c.Code] || 0;
      }
      themes[themeKey].count += 1;
    });
    return Object.keys(themes).map((theme) => ({
      subject: fixText(theme),
      island: parseFloat((themes[theme].islandSum / themes[theme].count).toFixed(2)),
      smr: selectedSmr ? parseFloat((themes[theme].smrSum / themes[theme].count).toFixed(2)) : 0,
      fullMark: 5,
    }));
  }, [scores, criteriaList, selectedSmr, smrProfiles]);

  const themeStats = useMemo(() => {
    if (!criteriaList.length) return [];
    const map = {};
    criteriaList.forEach((crit) => {
      const theme = getThemeValue(crit);
      if (!map[theme]) map[theme] = { theme, count: 0, sum: 0, risk: 0 };
      const score = scores[crit.Code] ?? 0;
      map[theme].count += 1;
      map[theme].sum += score;
      if (score < 2) map[theme].risk += 1;
    });
    return Object.values(map)
      .map((item) => ({
        ...item,
        avg: item.count ? parseFloat((item.sum / item.count).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [criteriaList, scores]);

  const themeWeightedStats = useMemo(() => {
    if (!criteriaList.length) return [];
    const map = {};
    criteriaList.forEach((crit) => {
      const theme = getThemeValue(crit);
      if (!map[theme]) map[theme] = { theme, weightedSum: 0, weightSum: 0 };
      const weightValue = Number(baseWeights[crit.Code]);
      const weight = Number.isFinite(weightValue) ? weightValue : 1;
      const score = scores[crit.Code] ?? 0;
      map[theme].weightedSum += score * weight;
      map[theme].weightSum += weight;
    });
    return Object.values(map)
      .map((item) => ({
        ...item,
        avg: item.weightSum ? parseFloat((item.weightedSum / item.weightSum).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [criteriaList, scores, baseWeights]);

  const criteriaByTheme = useMemo(() => {
    const map = {};
    criteriaList.forEach((crit) => {
      const theme = getThemeValue(crit);
      if (!map[theme]) map[theme] = [];
      map[theme].push(crit);
    });
    return map;
  }, [criteriaList]);

  const activeCriteriaCount = useMemo(() => {
    return criteriaList.filter((c) => Number(c['Inclure_ranking_SMR (0/1)']) === 1).length;
  }, [criteriaList]);

  const averageScore = useMemo(() => {
    if (!criteriaList.length) return 0;
    const total = criteriaList.reduce((sum, c) => sum + (scores[c.Code] ?? 0), 0);
    return parseFloat((total / criteriaList.length).toFixed(2));
  }, [criteriaList, scores]);

  const criticalCount = useMemo(() => {
    if (!criteriaList.length) return 0;
    return criteriaList.filter((c) => (scores[c.Code] ?? 0) < 2).length;
  }, [criteriaList, scores]);

  const smrCount = useMemo(() => Object.keys(smrProfiles).length, [smrProfiles]);

  const eligibleCount = useMemo(() => {
    if (!results) return smrCount;
    return results.ranking.length;
  }, [results, smrCount]);

  const disqualifiedCount = results?.disqualified?.length ?? 0;

  const criticalRatio = useMemo(() => {
    if (!criteriaList.length) return 0;
    return Math.min(100, (criticalCount / criteriaList.length) * 100);
  }, [criticalCount, criteriaList]);

  const techRatio = useMemo(() => {
    if (!smrCount) return 0;
    return Math.min(100, (eligibleCount / smrCount) * 100);
  }, [eligibleCount, smrCount]);

  const chartData = useMemo(() => {
    if (!results) return [];
    const eligible = results.ranking.map((item) => ({ ...item, disqualified: false }));
    const disqualified = (results.disqualified || []).map((item) => ({
      ...item,
      disqualified: true,
      disqualifyType:
        item.rule ||
        ((item.power_score ?? item.powerScore) != null &&
        (item.capex_score ?? item.capexScore) != null
          ? 'multi'
          : (item.power_score ?? item.powerScore) != null
            ? 'power'
            : 'capex'),
    }));
    return [...eligible, ...disqualified].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.disqualified === b.disqualified) return 0;
      return a.disqualified ? 1 : -1;
    });
  }, [results]);

  const hasCapexDisqualified = chartData.some(
    (item) => item.disqualified && (item.disqualifyType === 'capex' || item.disqualifyType === 'multi')
  );

  const hasPowerDisqualified = chartData.some(
    (item) => item.disqualified && (item.disqualifyType === 'power' || item.disqualifyType === 'multi')
  );

  const chartMax = useMemo(() => {
    if (!chartData.length) return 5;
    const maxScore = Math.max(...chartData.map((item) => Number(item.score) || 0));
    return Math.min(5, Math.max(4.5, Math.ceil(maxScore * 10) / 10));
  }, [chartData]);

  const statusLabel = results
    ? results.is_nogo
      ? 'No-Go'
      : 'Projet viable'
    : 'Simulation non lancée';

  const scenarioLabel = scenario === 'classic' ? 'Classique' : scenario;

  const scenarioOptions = [
    { value: 'classic', label: 'Classique' },
    { value: '2030', label: '2030' },
    { value: '2050', label: '2050' },
  ];

  const handleScenarioSelect = (value) => {
    setScenario(value);
    setScenarioMenuOpen(false);
  };

  const statusPillClass = results
    ? results.is_nogo
      ? 'panel-pill--danger'
      : 'panel-pill--success'
    : 'panel-pill--warning';

  const criteriaMap = useMemo(
    () => Object.fromEntries(criteriaList.map((crit) => [crit.Code, crit])),
    [criteriaList]
  );

  const hardNoGoCriteria = useMemo(
    () =>
      HARD_NO_GO_CODES.map((code) => {
        const crit = criteriaMap[code];
        const score = scores?.[code];
        return {
          code,
          label: crit ? getCriteriaLabel(crit) : code,
          score: Number.isFinite(score) ? score : null,
        };
      }),
    [criteriaMap, scores]
  );

  const hardNoGoTriggered = useMemo(
    () => hardNoGoCriteria.filter((item) => item.score !== null && item.score < 2),
    [hardNoGoCriteria]
  );

  const handleCalculate = async () => {
    setScenarioMenuOpen(false);
    setLoading(true);
    setSelectedSmr(null);
    try {
      const response = await axios.post(`${API_URL}/calculate`, {
        island_id: island.id,
        alpha,
        scenario,
        overrides: scores,
      });
      setResults(response.data);
    } catch (error) {
      alert("Erreur serveur. Vérifiez que le terminal Python est lancé.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setScores(originalScores);
    setResults(null);
    setSelectedSmr(null);
  };

  const toggleTheme = (theme) => setOpenTheme(openTheme === theme ? null : theme);

  return (
    <div className="simulation-panel-wrapper flex flex-col h-full w-full text-white relative">
      <div className="border-b border-cyan-500/10 bg-gradient-to-b from-slate-950/95 via-slate-900/80 to-slate-900/50 backdrop-blur-xl">
        <div className="px-12 py-9 flex flex-wrap items-start justify-between gap-10 relative">
          <div className="space-y-4 panel-title-block">
            <div className="panel-title-chip">
              <span className="panel-title-dot" />
              <span className="panel-title-text">Zone insulaire analysée</span>
            </div>
            <h2 className="text-3xl font-black text-white leading-tight panel-title">{fixText(island.name)}</h2>
            <div className="flex flex-wrap gap-4 panel-pad-inline panel-pill-row">
              <span className="panel-pill panel-pill--accent">Alpha {alpha.toFixed(1)}</span>
              <span className="panel-pill panel-pill--muted">
                {activeCriteriaCount}/{criteriaList.length} critères actifs
              </span>
              <span className={`panel-pill ${statusPillClass}`}>{statusLabel}</span>
              <div className="panel-actions-left">
                <div className="launch-group">
                  <button
                    onClick={handleCalculate}
                    disabled={loading}
                    className="panel-btn panel-btn-primary"
                  >
                    {loading ? (
                      <>
                        <Activity size={16} className="animate-spin" /> Calcul...
                      </>
                    ) : (
                      <>
                        <Play size={16} fill="currentColor" /> Lancer
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="panel-btn panel-btn-ghost panel-btn-split"
                    onClick={() => setScenarioMenuOpen((open) => !open)}
                  >
                    <ChevronDown size={14} />
                    {scenarioLabel}
                  </button>
                  {scenarioMenuOpen && (
                    <div className="scenario-menu">
                      {scenarioOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`scenario-option ${scenario === option.value ? 'scenario-option--active' : ''}`}
                          onClick={() => handleScenarioSelect(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleReset}
                  className="panel-btn panel-btn-ghost"
                >
                  <RotateCcw size={16} /> Réinitialiser
                </button>
                <div className="alpha-control">
                  <span className="alpha-label">Alpha</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={alpha}
                    onChange={(event) => setAlpha(parseFloat(event.target.value))}
                    className="alpha-slider"
                  />
                  <span className="alpha-value">{alpha.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="panel-btn panel-btn-icon panel-btn-close"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar panel-no-scroll px-14 py-12 space-y-12">
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-10">
          <div className="xl:col-span-2 panel-card panel-card--roomy rounded-3xl">
            <div className="flex flex-wrap items-center justify-between gap-6 mb-8 panel-pad-inline">
              <h3 className="font-semibold text-white text-xl flex items-center gap-5 section-title">
                <span className="panel-icon-wrap">
                  <Activity size={18} className="text-cyan-300" />
                </span>
                Lecture des vulnérabilités du site
              </h3>
              {selectedSmr ? (
                <button
                  onClick={() => setSelectedSmr(null)}
                  className="panel-pill panel-pill--warning panel-pill--normal"
                >
                  Comparaison: {fixText(selectedSmr)} • Effacer
                </button>
              ) : (
                <span className="text-xs text-cyan-300/70">Cliquez sur un SMR pour comparer</span>
              )}
            </div>
            <p className="text-sm text-slate-400 panel-pad-inline -mt-2">
              Cette vue synthétise les forces et fragilités du site, puis compare les SMR au besoin local.
            </p>
            {themeWeightedStats.length > 0 && (
              <div className="panel-gauge-section panel-pad-inline">
                <p className="panel-gauge-label">Moyenne pondérée par thématique (/5)</p>
                <div className="panel-gauge-grid">
                  {themeWeightedStats.map((item) => (
                    <div key={item.theme} className="panel-gauge-card">
                      <div className="panel-gauge-header">
                        <span className="panel-gauge-title">{fixText(item.theme)}</span>
                        <span className="panel-gauge-value">{item.avg}/5</span>
                      </div>
                      <div className="panel-gauge-track">
                        <div
                          className="panel-gauge-fill"
                          style={{ width: `${Math.min(100, (item.avg / 5) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {radarData.length > 0 ? (
              <div className="panel-card-soft panel-card--roomy rounded-2xl radar-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#0e7490" strokeDasharray="3" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fontSize: 11, fill: '#a1f5ff', fontWeight: 500 }}
                      tickFormatter={fixText}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                    <Radar name="Site" dataKey="island" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.15} strokeWidth={2.4} />
                    {selectedSmr && (
                      <Radar
                        name={fixText(selectedSmr)}
                        dataKey="smr"
                        stroke="#f59e0b"
                        fill="#f59e0b"
                        fillOpacity={0.2}
                        strokeWidth={2.4}
                      />
                    )}
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px', color: '#a1f5ff' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-slate-500 panel-pad-inline mt-2">Chargement du radar…</p>
            )}
          </div>

          <div className="space-y-7">
            <div className="panel-card-soft panel-card--roomy rounded-2xl stat-card stat-card--score">
              <div className="stat-header panel-pad-inline">
                <div className="stat-meta">
                  <p className="stat-kicker">Score moyen</p>
                  <div className="stat-value-row">
                    <span className="stat-value">{averageScore}</span>
                    <span className="stat-unit">/5</span>
                  </div>
                </div>
                <div className="panel-icon-wrap">
                  <Activity size={20} className="text-cyan-300" />
                </div>
              </div>
              <div className="stat-meter panel-pad-inline">
                <div className="stat-meter-track">
                  <div
                    className="stat-meter-fill"
                    style={{ width: `${Math.min(100, (averageScore / 5) * 100)}%` }}
                  />
                </div>
                <p className="stat-sub">Moyenne pondérée globale</p>
              </div>
            </div>

            <div className="panel-card-soft panel-card--roomy rounded-2xl stat-card stat-card--danger">
              <div className="stat-header panel-pad-inline">
                <div className="stat-meta">
                  <p className="stat-kicker">Critères critiques</p>
                  <div className="stat-value-row">
                    <span className={`stat-value ${criticalCount > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                      {criticalCount}
                    </span>
                    <span className="stat-unit">
                      / {criteriaList.length || '-'}
                    </span>
                  </div>
                </div>
                <div
                  className={`panel-icon-wrap ${
                    criticalCount > 0 ? 'bg-red-500/10 border-red-400/40' : 'bg-emerald-500/10 border-emerald-400/40'
                  }`}
                >
                  <AlertTriangle size={20} className={criticalCount > 0 ? 'text-red-300' : 'text-emerald-300'} />
                </div>
              </div>
              <div className="stat-meter panel-pad-inline">
                <div className="stat-meter-track">
                  <div
                    className="stat-meter-fill stat-meter-fill--danger"
                    style={{ width: `${criticalRatio}%` }}
                  />
                </div>
                <p className="stat-sub">Scores &lt; 2/5 détectés</p>
              </div>
            </div>

            <div className="panel-card-soft panel-card--roomy rounded-2xl stat-card stat-card--info">
              <div className="stat-header panel-pad-inline">
                <div className="stat-meta">
                  <p className="stat-kicker">Technologies analysées</p>
                  <div className="stat-value-row">
                    <span className="stat-value">{eligibleCount}</span>
                    <span className="stat-unit">/ {smrCount}</span>
                  </div>
                  {disqualifiedCount > 0 && (
                    <span className="stat-alert">+ {disqualifiedCount} disqualifiés</span>
                  )}
                </div>
                <div className="panel-icon-wrap">
                  <IconBarChart size={20} className="text-cyan-300" />
                </div>
              </div>
              <div className="stat-meter panel-pad-inline">
                <div className="stat-meter-track">
                  <div
                    className="stat-meter-fill stat-meter-fill--info"
                    style={{ width: `${techRatio}%` }}
                  />
                </div>
                <p className="stat-sub">Cliquez pour comparer au radar</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-9">
          <div className="flex items-center justify-between gap-3 panel-pad-inline">
            <h3 className="text-xl font-bold text-white flex items-center gap-5 section-title">
              <span className="panel-icon-wrap">
                <IconBarChart size={20} className="text-cyan-300" />
              </span>
              Résultats & classement
            </h3>
            {results && (
              <span className="text-xs text-slate-400">
                {results.ranking.length} SMR classés
                {results.disqualified?.length ? ` • ${results.disqualified.length} disqualifiés` : ''}
              </span>
            )}
          </div>

          {!results && (
            <div className="panel-card-soft panel-card--roomy rounded-2xl">
              <div className="flex items-start justify-between gap-6 panel-pad-inline">
                <div>
                  <h4 className="text-base font-semibold text-white">Lancer la simulation</h4>
                  <p className="text-sm text-slate-400 mt-1">
                    Ajustez les scores et lancez le calcul pour afficher le classement.
                  </p>
                </div>
                <div className="panel-icon-wrap">
                  <Activity size={18} className="text-cyan-300" />
                </div>
              </div>
            </div>
          )}

          {results && (
            <div className="space-y-8">
              <div
                className={`panel-status-banner rounded-2xl border flex items-start gap-4 shadow-lg panel-pad-inline ${
                  results.is_nogo
                    ? 'panel-status-banner--danger'
                    : 'panel-status-banner--success'
                }`}
              >
                <div
                  className={`panel-status-icon ${
                    results.is_nogo ? 'panel-status-icon--danger' : 'panel-status-icon--success'
                  }`}
                >
                  {results.is_nogo ? <AlertTriangle size={22} /> : <CheckCircle size={22} />}
                </div>
                <div className="flex-1">
                  {results.is_nogo ? (
                    <>
                      <div className="nogo-title-row">
                        <h4 className="nogo-title">Projet critique</h4>
                        <span className="nogo-pill">No-Go</span>
                      </div>
                      <p className="nogo-sub">
                        Des critères bloquants empêchent le projet d'être viable pour ce site.
                      </p>
                      <div className="nogo-count">
                        {hardNoGoTriggered.length} contraintes bloquantes
                      </div>
                      <p className="nogo-hard-label">Contraintes Hard No-Go</p>
                      <div className="nogo-list">
                        {hardNoGoTriggered.map((item) => (
                          <div key={item.code} className="nogo-item">
                            <span className="nogo-item-label">
                              {item.code} · {item.label}
                            </span>
                            <span className="nogo-item-score">
                              {item.score !== null ? `Score ${item.score.toFixed(1)}` : 'Seuil < 2'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <h4 className="font-semibold text-base mb-2 status-title">Projet viable</h4>
                      <p className="text-sm opacity-80 leading-relaxed">
                        Tous les critères d'exclusion sont respectés.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {results.disqualified?.length > 0 && (
                  <div className="panel-card-soft panel-card--roomy rounded-2xl">
                    <div className="flex items-center justify-between gap-6 panel-pad-inline">
                      <div>
                        <p className="panel-kicker text-rose-200/70">SMR disqualifiés</p>
                        <div className="disqualified-legend">
                          <span className="disqualified-legend-title">Légende</span>
                          <div className="disqualified-rules">
                            <span className="disqualified-rule disqualified-rule--capex">
                              <span className="disqualified-rule-dot disqualified-rule-dot--capex" />
                              CAPEX (ECO3) &lt; 2
                            </span>
                            <span className="disqualified-rule disqualified-rule--power">
                              <span className="disqualified-rule-dot disqualified-rule-dot--power" />
                              Adéquation puissance / taille réseau (ECO1) &lt; 2
                            </span>
                          </div>
                        </div>
                        <div className="disqualified-separator" />
                      </div>
                      <div className="panel-icon-wrap bg-red-500/10 border-red-400/40">
                        <AlertTriangle size={18} className="text-red-300" />
                      </div>
                    </div>
                  <div className="disqualified-list panel-pad-inline">
                    {results.disqualified.map((item) => {
                      const capexValue = item.capex_score ?? item.capexScore;
                      const powerValue = item.power_score ?? item.powerScore;
                      const disqualifyType =
                        item.rule ||
                        (capexValue != null && powerValue != null
                          ? 'multi'
                          : powerValue != null
                            ? 'power'
                            : 'capex');
                      const badgeParts = [];
                      if (capexValue != null) badgeParts.push(`CAPEX ${capexValue}`);
                      if (powerValue != null) badgeParts.push(`ECO1 ${powerValue}`);
                      const badgeText = badgeParts.length
                        ? badgeParts.join(' • ')
                        : fixText(item.reason || 'Disqualifié');
                      return (
                        <div key={item.technologie} className={`disqualified-chip disqualified-chip--${disqualifyType}`}>
                          <span className="disqualified-name">{fixText(item.technologie)}</span>
                          <span className={`disqualified-score disqualified-score--${disqualifyType}`}>
                            {badgeText}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-9">
                <div className="xl:col-span-2 panel-card panel-card--roomy rounded-2xl">
                  <h4 className="chart-title">Classement des SMR (score global)</h4>
                  <div className="smr-chart">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ left: 120, right: 30, top: 28, bottom: 10 }}
                        onClick={(data) => {
                          const payload = data?.activePayload?.[0]?.payload;
                          if (!payload || payload.disqualified) return;
                          setSelectedSmr(payload.technologie);
                        }}
                        className="cursor-pointer"
                        barCategoryGap={12}
                      >
                        <defs>
                          <linearGradient id="smrGlow" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.95} />
                            <stop offset="50%" stopColor="#38bdf8" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.95} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(56, 189, 248, 0.12)" strokeDasharray="4 6" horizontal={false} />
                        <ReferenceLine
                          x={4}
                          stroke="rgba(56, 189, 248, 0.35)"
                          strokeDasharray="6 6"
                          label={{ value: 'Seuil 4/5', position: 'top', fill: '#7dd3fc', fontSize: 10, dy: -8 }}
                        />
                        <XAxis type="number" domain={[0, chartMax]} stroke="#0e7490" hide />
                        <YAxis
                          dataKey="technologie"
                          type="category"
                          width={170}
                          tick={<SmrTick />}
                          interval={0}
                          tickLine={{ stroke: 'rgba(148, 163, 184, 0.45)' }}
                        />
                      <Tooltip content={<CustomTooltip />} cursor={false} />
                        <Bar
                          dataKey="score"
                          radius={[0, 10, 10, 0]}
                          barSize={22}
                          background={<BarTrack />}
                        >
                        {chartData.map((entry, index) => {
                          const disqualifyType = entry.disqualifyType || 'capex';
                          const disqualifyFill =
                            disqualifyType === 'power'
                              ? 'rgba(167, 139, 250, 0.35)'
                              : disqualifyType === 'multi'
                                ? 'rgba(244, 114, 182, 0.35)'
                                : 'rgba(248, 113, 113, 0.35)';
                          const disqualifyStroke =
                            disqualifyType === 'power'
                              ? 'rgba(167, 139, 250, 0.75)'
                              : disqualifyType === 'multi'
                                ? 'rgba(244, 114, 182, 0.8)'
                                : 'rgba(248, 113, 113, 0.75)';
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                entry.disqualified
                                  ? disqualifyFill
                                  : entry.technologie === selectedSmr
                                    ? '#f59e0b'
                                    : 'url(#smrGlow)'
                              }
                              stroke={entry.disqualified ? disqualifyStroke : 'transparent'}
                              strokeDasharray={entry.disqualified ? '4 4' : '0'}
                              className="transition-all duration-300 hover:opacity-80"
                            />
                          );
                        })}
                          <LabelList
                            dataKey="score"
                            position="right"
                            formatter={(value) => Number(value).toFixed(2)}
                            fill="#e2f8ff"
                            fontSize={11}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-legend">
                    <span className="legend-item">
                      <span className="legend-swatch legend-swatch--selected" />
                      SMR sélectionné
                    </span>
                    {hasCapexDisqualified && (
                      <span className="legend-item">
                        <span className="legend-swatch legend-swatch--disqualified" />
                        Disqualifié (CAPEX)
                      </span>
                    )}
                    {hasPowerDisqualified && (
                      <span className="legend-item">
                        <span className="legend-swatch legend-swatch--disqualified-power" />
                        Disqualifié (ECO1)
                      </span>
                    )}
                  </div>
                  <p className="text-center text-xs text-cyan-300/70 mt-3 flex justify-center items-center gap-2 font-medium">
                    <Info size={14} /> Cliquez pour comparer
                  </p>
                </div>

                <div className="panel-card-soft panel-card--roomy rounded-2xl">
                  <h4 className="top3-title">Top 3</h4>
                  <div className="top3-list">
                    {results.ranking.slice(0, 3).map((entry, index) => (
                      <div key={entry.technologie} className={`top3-row top3-row--${index + 1}`}>
                        <div className="top3-row-main">
                          <span className="top3-rank">#{index + 1}</span>
                          <div className="top3-meta">
                            <span className="top3-name">{fixText(entry.technologie)}</span>
                            <div className="top3-bar">
                              <div
                                className="top3-bar-fill"
                                style={{ width: `${Math.min(100, (entry.score / 5) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="top3-score">
                          <span className="top3-score-label">Score</span>
                          <span className="top3-score-value">{entry.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        
      </div>
    </div>
  );
}
