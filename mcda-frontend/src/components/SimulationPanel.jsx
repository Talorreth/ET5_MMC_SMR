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
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
} from 'recharts';

const API_URL = "http://127.0.0.1:8000";
const BAR_COLORS = ['#22d3ee', '#38bdf8', '#60a5fa', '#a78bfa', '#f59e0b'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950/95 p-3 border border-cyan-500/30 shadow-2xl rounded-xl text-xs">
        <p className="font-semibold text-cyan-300 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="flex items-center gap-2 text-slate-100">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }}></span>
            {entry.name}: <span className="font-mono font-bold">{entry.value}</span>
          </p>
        ))}
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
  const [alpha, setAlpha] = useState(0.3);
  const [results, setResults] = useState(null);
  const [selectedSmr, setSelectedSmr] = useState(null);
  const [openTheme, setOpenTheme] = useState(null);

  const getThemeValue = (crit) =>
    crit['Thématique'] ?? crit.Thematique ?? 'Autre';

  const getCriteriaLabel = (crit) =>
    crit['Critère'] ?? crit.Critere ?? 'Critère';

  const getExplication = (crit) =>
    crit.Explications ?? crit.Explication ?? '';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [critRes, islandRes, smrRes] = await Promise.all([
          axios.get(`${API_URL}/criteria`),
          axios.get(`${API_URL}/islands`),
          axios.get(`${API_URL}/smrs`),
        ]);
        setCriteriaList(critRes.data || []);
        setSmrProfiles(smrRes.data || {});
        if (islandRes.data && islandRes.data[island.id]) {
          setScores(islandRes.data[island.id]);
          setOriginalScores(islandRes.data[island.id]);
        }
      } catch (error) {
        console.error("Erreur chargement:", error);
      }
    };
    fetchData();
    setResults(null);
    setSelectedSmr(null);
  }, [island.id]);

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
      subject: theme,
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

  const statusLabel = results
    ? results.is_nogo
      ? 'No-Go'
      : 'Projet viable'
    : 'Simulation non lancée';

  const statusPillClass = results
    ? results.is_nogo
      ? 'panel-pill--danger'
      : 'panel-pill--success'
    : 'panel-pill--warning';

  const handleCalculate = async () => {
    setLoading(true);
    setSelectedSmr(null);
    try {
      const response = await axios.post(`${API_URL}/calculate`, {
        island_id: island.id,
        alpha,
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
        <div className="px-8 py-6 flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="panel-kicker flex items-center gap-2 text-cyan-300/70">
              <MapPin size={12} className="text-cyan-300" />
              Site pilote
            </div>
            <h2 className="text-3xl font-black text-white leading-tight">{island.name}</h2>
            <div className="flex flex-wrap gap-2">
              <span className="panel-pill panel-pill--accent">Alpha {alpha.toFixed(1)}</span>
              <span className="panel-pill panel-pill--muted">
                {activeCriteriaCount}/{criteriaList.length} critères actifs
              </span>
              <span className={`panel-pill ${statusPillClass}`}>{statusLabel}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
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
              onClick={handleReset}
              className="panel-btn panel-btn-ghost"
            >
              <RotateCcw size={16} /> Réinitialiser
            </button>
            <button
              onClick={onClose}
              className="panel-btn panel-btn-icon"
              aria-label="Fermer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8 space-y-8">
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 panel-card rounded-3xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <h3 className="font-semibold text-white text-lg flex items-center gap-3">
                <span className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30">
                  <Activity size={18} className="text-cyan-300" />
                </span>
                Profil de vulnérabilité
              </h3>
              {selectedSmr ? (
                <button
                  onClick={() => setSelectedSmr(null)}
                  className="panel-pill panel-pill--warning panel-pill--normal"
                >
                  Comparaison: {selectedSmr} • Effacer
                </button>
              ) : (
                <span className="text-xs text-cyan-300/70">Cliquez sur un SMR pour comparer</span>
              )}
            </div>
            <div className="panel-card-soft h-80 w-full rounded-2xl p-4">
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#0e7490" strokeDasharray="3" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#a1f5ff', fontWeight: 500 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                    <Radar name="Site" dataKey="island" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.15} strokeWidth={2.4} />
                    {selectedSmr && (
                      <Radar name={selectedSmr} dataKey="smr" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} strokeWidth={2.4} />
                    )}
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px', color: '#a1f5ff' }} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  <div className="text-center">
                    <Activity className="mx-auto mb-2 animate-spin opacity-20" size={28} />
                    <p className="text-sm">Chargement...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="panel-card-soft rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="panel-kicker text-cyan-300/70">Score moyen</p>
                  <p className="text-2xl font-bold text-white mt-2">{averageScore}</p>
                </div>
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                  <Activity size={20} className="text-cyan-300" />
                </div>
              </div>
              <div className="mt-4 h-2 rounded-full bg-slate-800/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500"
                  style={{ width: `${Math.min(100, (averageScore / 5) * 100)}%` }}
                />
              </div>
            </div>

            <div className="panel-card-soft rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="panel-kicker text-cyan-300/70">Critères critiques</p>
                  <p className={`text-2xl font-bold mt-2 ${criticalCount > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                    {criticalCount}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-xl border ${
                    criticalCount > 0 ? 'bg-red-500/10 border-red-400/40' : 'bg-emerald-500/10 border-emerald-400/40'
                  }`}
                >
                  <AlertTriangle size={20} className={criticalCount > 0 ? 'text-red-300' : 'text-emerald-300'} />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Scores inférieurs à 2/5 sur le profil site.
              </p>
            </div>

            <div className="panel-card-soft rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="panel-kicker text-cyan-300/70">Technologies analysées</p>
                  <p className="text-2xl font-bold text-white mt-2">{smrCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                  <IconBarChart size={20} className="text-cyan-300" />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Cliquez sur un résultat pour comparer au radar.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-white flex items-center gap-3">
              <span className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30">
                <IconBarChart size={20} className="text-cyan-300" />
              </span>
              Résultats & classement
            </h3>
            {results && (
              <span className="text-xs text-slate-400">
                {results.ranking.length} SMR classés
              </span>
            )}
          </div>

          {!results && (
            <div className="panel-card-soft rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                  <Activity size={18} className="text-cyan-300" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-white">Lancer la simulation</h4>
                  <p className="text-sm text-slate-400 mt-1">
                    Ajustez les scores et lancez le calcul pour afficher le classement.
                  </p>
                </div>
              </div>
            </div>
          )}

          {results && (
            <div className="space-y-6">
              <div
                className={`p-5 rounded-2xl border flex items-start gap-4 shadow-lg ${
                  results.is_nogo
                    ? 'bg-red-500/10 border-red-500/40 text-red-200'
                    : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                }`}
              >
                <div
                  className={`p-3 rounded-xl flex-shrink-0 ${
                    results.is_nogo ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {results.is_nogo ? <AlertTriangle size={22} /> : <CheckCircle size={22} />}
                </div>
                <div>
                  <h4 className="font-semibold text-base mb-2">
                    {results.is_nogo ? 'Projet critique (No-Go)' : 'Projet viable'}
                  </h4>
                  <p className="text-sm opacity-80 leading-relaxed">
                    {results.is_nogo
                      ? `Contraintes bloquantes : ${results.nogo_reasons.join(', ')}`
                      : "Tous les critères d'exclusion sont respectés."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 panel-card rounded-2xl p-6">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                      data={results.ranking.slice(0, 12)}
                      layout="vertical"
                      margin={{ left: 120, right: 20, top: 5, bottom: 5 }}
                      onClick={(data) => data?.activePayload && setSelectedSmr(data.activePayload[0].payload.technologie)}
                      className="cursor-pointer"
                    >
                      <XAxis type="number" domain={[0, 5]} stroke="#0e7490" hide />
                      <YAxis
                        dataKey="technologie"
                        type="category"
                        width={120}
                        tick={{ fontSize: 11, fontWeight: 500, fill: '#a1f5ff' }}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#0e7490' }} />
                      <Bar dataKey="score" radius={[0, 8, 8, 0]} barSize={20}>
                        {results.ranking.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.technologie === selectedSmr
                                ? '#f59e0b'
                                : BAR_COLORS[index % BAR_COLORS.length]
                            }
                            className="transition-all duration-300 hover:opacity-80"
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-center text-xs text-cyan-300/70 mt-3 flex justify-center items-center gap-2 font-medium">
                    <Info size={14} /> Cliquez pour comparer
                  </p>
                </div>

                <div className="panel-card-soft rounded-2xl p-5">
                  <h4 className="text-sm font-semibold text-cyan-200 uppercase tracking-[0.2em]">Top 3</h4>
                  <div className="mt-4 space-y-3">
                    {results.ranking.slice(0, 3).map((entry, index) => (
                      <div
                        key={entry.technologie}
                        className={`panel-row rounded-xl p-3 ${index === 0 ? 'panel-row--highlight' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-slate-400">#{index + 1}</p>
                            <p className="text-sm font-semibold text-white leading-tight">
                              {entry.technologie}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-400">Score</p>
                            <p className="text-lg font-bold text-cyan-200">{entry.score}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="border-t border-cyan-500/10 pt-8 pb-20 space-y-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <span className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30">
              <SlidersHorizontal size={20} className="text-cyan-300" />
            </span>
            Configuration
          </h3>

          <div className="panel-card rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <label className="font-semibold text-white text-base">Sensibilité (Alpha)</label>
                <p className="text-xs text-cyan-300/60 mt-1">
                  0 = besoins dominants · 1 = poids de base uniquement
                </p>
              </div>
              <span className="text-2xl font-bold text-cyan-200 bg-slate-900/50 px-4 py-2 rounded-lg border border-cyan-500/40 font-mono">
                {alpha.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={alpha}
              onChange={(e) => setAlpha(parseFloat(e.target.value))}
              className="w-full h-2 bg-cyan-600/30 rounded-lg appearance-none cursor-pointer"
              style={{
                accentColor: '#22d3ee',
              }}
            />
          </div>

          <div className="space-y-3">
            {themeStats.map((theme) => (
              <div
                key={theme.theme}
                className="panel-card-soft rounded-2xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleTheme(theme.theme)}
                  className="w-full flex flex-wrap justify-between items-center gap-4 p-5 hover:bg-slate-800/50 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-1 h-10 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-full" />
                    <div>
                      <span className="font-semibold text-sm text-cyan-200 uppercase tracking-tight">
                        {theme.theme}
                      </span>
                      <div className="text-xs text-slate-400 mt-1">
                        {theme.count} critères · moyenne {theme.avg}/5
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {theme.risk > 0 && (
                      <span className="panel-pill panel-pill--danger panel-pill--normal">
                        {theme.risk} critique{theme.risk > 1 ? 's' : ''}
                      </span>
                    )}
                    {openTheme === theme.theme ? (
                      <ChevronUp size={20} className="text-cyan-300" />
                    ) : (
                      <ChevronDown size={20} className="text-slate-500" />
                    )}
                  </div>
                </button>

                {openTheme === theme.theme && (
                  <div className="panel-inset p-4 space-y-4 animate-fade-in">
                    {(criteriaByTheme[theme.theme] || []).map((crit) => (
                      <div
                        key={crit.Code}
                        className="panel-row rounded-xl p-4"
                      >
                        <div className="flex justify-between items-end mb-3">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-xs font-bold text-white bg-gradient-to-br from-cyan-600 to-blue-700 w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 shadow-md">
                              {crit.Code}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-bold text-white block truncate" title={getCriteriaLabel(crit)}>
                                {getCriteriaLabel(crit)}
                              </span>
                              <span className="text-xs text-cyan-300/70">
                                <span
                                  className={`font-bold ${
                                    scores[crit.Code] < 2 ? 'text-red-400' : 'text-cyan-400'
                                  }`}
                                >
                                  {scores[crit.Code] || 0}
                                </span>
                                /5
                              </span>
                            </div>
                            {getExplication(crit) && (
                              <div className="group relative">
                                <Info size={16} className="text-slate-500 hover:text-cyan-400 cursor-help" />
                                <div className="absolute left-0 bottom-8 w-56 p-3 bg-slate-950 border border-cyan-500/40 text-white text-xs rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 leading-snug">
                                  {getExplication(crit)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="1"
                          value={scores[crit.Code] || 0}
                          onChange={(e) => setScores((prev) => ({ ...prev, [crit.Code]: parseInt(e.target.value) }))}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer transition"
                          style={{
                            accentColor: scores[crit.Code] < 2 ? '#f87171' : '#22d3ee',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
