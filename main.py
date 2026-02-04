import os
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MCDA NuclÃ©aire API")

# Configuration CORS pour autoriser le futur Frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Ã€ restreindre en prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURATION GLOBALE ---
DATA_DIR = "data"
ISLAND_PROFILE_FILES = {
    "indonesie": "profil_indonesie.csv",
    "philippines": "profil_philippines.csv",
    "barbade": "profil_barbade.csv"
}
CRITERES_NO_GO = ['GS', 'HG', 'PF', 'LU', 'ER', 'SOC2', 'ENV6', 'GEO2', 'GEO5']
SEUIL_NO_GO = 2.0

# --- CHARGEMENT DES DONNÃ‰ES AU DÃ‰MARRAGE ---
def load_profiles(files, suffix=None, score_column="Score ile (0-5)"):
    profiles = {}
    for key, filename in files.items():
        if suffix:
            name, ext = os.path.splitext(filename)
            filename = f"{name}_{suffix}{ext}"
        path = os.path.join(DATA_DIR, filename)
        if os.path.exists(path):
            df = pd.read_csv(path)
            if score_column not in df.columns:
                print(f"âš ï¸ Colonne '{score_column}' manquante dans {filename}")
                continue
            df_out = df[['Code', score_column, 'Poids base', 'Critere', 'Thematique']].copy()
            df_out = df_out.rename(columns={score_column: 'Score ile (0-5)'})
            profiles[key] = df_out
        else:
            print(f"âš ï¸ Fichier manquant: {filename}")
    return profiles


def load_data():
    try:
        # 1. Chargement des scores SMR
        smr_path = os.path.join(DATA_DIR, "scoring_smr.csv")
        df_smr = pd.read_csv(smr_path)
        
        # Nettoyage des noms de colonnes SMR
        # On identifie les colonnes SMR (toutes sauf les mÃ©tadonnÃ©es)
        meta_cols = ['Thematique', 'Code', 'Critere', 'Explications', 'Inclure_ranking_SMR (0/1)', 'Justification / source']
        smr_cols = [c for c in df_smr.columns if c not in meta_cols]
        
        # 2. Chargement des profils iles
        profiles = load_profiles(ISLAND_PROFILE_FILES)
        profiles_2030 = load_profiles(ISLAND_PROFILE_FILES, "2030")
        profiles_2050 = load_profiles(ISLAND_PROFILE_FILES, "2050")

        if not profiles_2030:
            profiles_2030 = load_profiles(files, score_column="Score 2030")

        if not profiles_2050:
            profiles_2050 = load_profiles(files, score_column="Score 2050")

        scenarios = {
            "classic": profiles,
            "2030": profiles_2030,
            "2050": profiles_2050
        }

        return df_smr, smr_cols, profiles, scenarios

    except Exception as e:
        print(f"Erreur au chargement des donnÃ©es: {e}")
        return None, [], {}, {}

df_smr_global, smr_list_global, profiles_global, scenarios_global = load_data()


def resolve_profiles(scenario: str):
    if not scenario or scenario == "classic":
        return profiles_global
    profiles = scenarios_global.get(scenario) or {}
    if profiles:
        return profiles
    # Recharge à la volée si les fichiers ont été ajoutés après le démarrage
    profiles = load_profiles(ISLAND_PROFILE_FILES, scenario)
    if profiles:
        scenarios_global[scenario] = profiles
        return profiles
    return profiles_global


def resolve_profile(island_id: str, scenario: str):
    scenario_profiles = resolve_profiles(scenario)
    if island_id in scenario_profiles:
        return scenario_profiles[island_id].copy()
    return profiles_global[island_id].copy()

# --- MODÃˆLES DE DONNÃ‰ES (Pydantic) ---
class CalculationRequest(BaseModel):
    island_id: str  # "indonesie", "philippines", "barbade"
    alpha: float = 0.3
    overrides: Optional[Dict[str, float]] = None # Ex: {"GEO1": 5.0}
    scenario: Optional[str] = "classic"

class RankingItem(BaseModel):
    technologie: str
    score: float

class DisqualifiedItem(BaseModel):
    technologie: str
    score: float
    capex_score: Optional[float] = None
    power_score: Optional[float] = None
    rule: Optional[str] = None
    reason: str

class CalculationResponse(BaseModel):
    island_id: str
    is_nogo: bool
    nogo_reasons: List[str]
    ranking: List[RankingItem]
    disqualified: List[DisqualifiedItem] = []

# --- ENDPOINTS ---

@app.get("/")
def read_root():
    return {"status": "API MCDA NuclÃ©aire opÃ©rationnelle"}

@app.get("/islands")
def get_islands(scenario: str = "classic"):
    """Renvoie la liste des iles disponibles et leurs scores initiaux"""
    scenario_profiles = resolve_profiles(scenario)
    data = {}
    for island_id, df in profiles_global.items():
        df_source = scenario_profiles.get(island_id, df)
        # Convertit le DataFrame en dictionnaire simple {Code: Score}
        scores = dict(zip(df_source['Code'], df_source['Score ile (0-5)']))
        data[island_id] = scores
    return data

@app.get("/criteria")
def get_criteria():
    """Renvoie la liste des Criteres (Code, Nom, Thematique, Explications) pour l'UI"""
    # CORRECTION ICI : Ajout de 'Explications'
    cols_to_keep = ['Code', 'Critere', 'Thematique', 'Inclure_ranking_SMR (0/1)', 'Explications']
    
    # On vÃ©rifie que les colonnes existent (pour Ã©viter un crash si le CSV est vieux)
    actual_cols = [c for c in cols_to_keep if c in df_smr_global.columns]
    
    df = df_smr_global[actual_cols].copy()
    
    # On remplace les NaN (vides) par une chaine vide pour le JSON
    df['Explications'] = df['Explications'].fillna("")
    
    return df.to_dict(orient="records")

@app.get("/weights")
def get_weights():
    """Renvoie les poids de base par critÃ¨re pour chaque Ã®le."""
    data = {}
    for island_id, df in profiles_global.items():
        if 'Poids base' in df.columns:
            weights = dict(zip(df['Code'], df['Poids base']))
        else:
            weights = dict(zip(df['Code'], [1] * len(df)))
        data[island_id] = weights
    return data

@app.post("/calculate", response_model=CalculationResponse)
def calculate(req: CalculationRequest):
    """
    CÅ“ur du rÃ©acteur : Recalcule le classement en fonction des inputs
    """
    if req.island_id not in profiles_global:
        raise HTTPException(status_code=404, detail="ile inconnue")

    # 1. RÃ©cupÃ©ration du profil de base
    df_ile = resolve_profile(req.island_id, req.scenario or "classic")
    
    # 2. Application des Overrides (Modifications utilisateur)
    if req.overrides:
        for code, new_score in req.overrides.items():
            # Mise Ã  jour du score dans la ligne correspondante
            df_ile.loc[df_ile['Code'] == code, 'Score ile (0-5)'] = new_score

    # 3. PrÃ©paration des donnÃ©es SMR (Filtre des Criteres actifs)
    # On ne garde que les Criteres marquÃ©s "1" dans Inclure_ranking
    active_criteria_codes = df_smr_global[df_smr_global['Inclure_ranking_SMR (0/1)'] == 1]['Code'].tolist()
    
    # Fusionner Profil ile + Scores SMR
    # On merge sur 'Code'
    df_merged = pd.merge(
        df_ile, 
        df_smr_global[['Code'] + smr_list_global], 
        on='Code', 
        how='inner'
    )
    
    # Filtrer pour ne garder que les Criteres actifs pour le calcul
    df_calc = df_merged[df_merged['Code'].isin(active_criteria_codes)].copy()

    # 4. Calculs des Poids (Logique Excel)
    # Besoin = (5 - Score) / 5
    df_calc['Besoin'] = (5 - df_calc['Score ile (0-5)']) / 5
    
    # Poids AjustÃ© = Poids_base * (Alpha + (1-Alpha) * Besoin)
    df_calc['Poids_ajustÃ©'] = df_calc['Poids base'] * (req.alpha + (1 - req.alpha) * df_calc['Besoin'])
    
    # 5. DÃ©tection Hard No-Go
    # On vÃ©rifie sur TOUS les Criteres fusionnÃ©s (mÃªme ceux exclus du ranking s'ils sont critiques ?)
    # Par sÃ©curitÃ©, on vÃ©rifie sur df_merged (tous les Criteres dispos)
    is_nogo = False
    reasons = []
    
    for _, row in df_merged.iterrows():
        if row['Code'] in CRITERES_NO_GO:
            if row['Score ile (0-5)'] < SEUIL_NO_GO:
                is_nogo = True
                reasons.append(f"{row['Critere']} (Score: {row['Score ile (0-5)']})")

    # 6. Calcul des Scores SMR
    ranking = []
    total_weight = df_calc['Poids_ajustÃ©'].sum()

    # Règle spéciale Barbade : disqualification si CAPEX (ECO3) < 2
    disqualified = []
    disqualified_set = set()
    disqualified_meta = {}
    if req.island_id == "barbade":
        capex_row = df_smr_global[df_smr_global['Code'] == 'ECO3']
        power_row = df_smr_global[df_smr_global['Code'] == 'ECO1']
        capex_row = capex_row.iloc[0] if not capex_row.empty else None
        power_row = power_row.iloc[0] if not power_row.empty else None

        if capex_row is not None or power_row is not None:
            for smr in smr_list_global:
                reasons = []
                capex_value = None
                power_value = None
                if capex_row is not None:
                    capex_score = pd.to_numeric(capex_row.get(smr), errors='coerce')
                    capex_value = float(capex_score) if not pd.isna(capex_score) else 0.0
                    if capex_value < 2:
                        reasons.append("CAPEX (ECO3) < 2")
                if power_row is not None:
                    power_score = pd.to_numeric(power_row.get(smr), errors='coerce')
                    power_value = float(power_score) if not pd.isna(power_score) else 0.0
                    if power_value < 2:
                        reasons.append("Adéquation puissance / taille réseau (ECO1) < 2")
                if reasons:
                    disqualified_set.add(smr)
                    disqualified_meta[smr] = {
                        "capex": capex_value if capex_value is not None and capex_value < 2 else None,
                        "power": power_value if power_value is not None and power_value < 2 else None,
                        "reasons": reasons
                    }

    if total_weight == 0:
        total_weight = 1 # Ã‰viter division par zÃ©ro
        
    for smr in smr_list_global:
        # Nettoyage des scores SMR (valeurs non numÃ©riques -> 0)
        smr_scores = pd.to_numeric(df_calc[smr], errors='coerce').fillna(0)
        
        # Moyenne pondÃ©rÃ©e
        weighted_score = np.dot(smr_scores, df_calc['Poids_ajustÃ©']) / total_weight
        rounded_score = round(weighted_score, 2)

        if smr in disqualified_set:
            meta = disqualified_meta.get(smr, {})
            reasons = meta.get("reasons", [])
            capex_value = meta.get("capex")
            power_value = meta.get("power")
            rule = "capex"
            if capex_value is not None and power_value is not None:
                rule = "multi"
            elif power_value is not None:
                rule = "power"
            disqualified.append(
                DisqualifiedItem(
                    technologie=smr,
                    score=rounded_score,
                    capex_score=round(capex_value, 2) if capex_value is not None else None,
                    power_score=round(power_value, 2) if power_value is not None else None,
                    rule=rule,
                    reason=" / ".join(reasons) if reasons else "Disqualifié"
                )
            )
            continue

        ranking.append(RankingItem(technologie=smr, score=rounded_score))
        
    # Tri dÃ©croissant
    ranking.sort(key=lambda x: x.score, reverse=True)

    return CalculationResponse(
        island_id=req.island_id,
        is_nogo=is_nogo,
        nogo_reasons=reasons,
        ranking=ranking,
        disqualified=disqualified
    )

@app.get("/smrs")
def get_smr_profiles():
    """
    Renvoie les scores bruts (0-5) de tous les SMR pour l'affichage radar.
    """
    # On filtre les colonnes non-pertinentes
    # On veut un dict : { "Nuward": { "GS": 5, "ECO1": 3... }, ... }
    
    # 1. Identifier les colonnes SMR (celles qui sont dans smr_list_global)
    # et la colonne 'Code'
    cols_to_keep = ['Code'] + smr_list_global
    
    # 2. CrÃ©er le dictionnaire
    smr_data = {}
    
    # Pour chaque SMR, on construit son profil
    for smr in smr_list_global:
        # On crÃ©e une map {Code_Critere: Score}
        # Attention: il faut gÃ©rer les valeurs NaN
        scores = dict(zip(
            df_smr_global['Code'], 
            pd.to_numeric(df_smr_global[smr], errors='coerce').fillna(0)
        ))
        smr_data[smr] = scores
        
    return smr_data


if __name__ == "__main__":
    import uvicorn
    # Lance le serveur en mode dev (auto-reload)
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

