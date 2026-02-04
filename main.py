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
CRITERES_NO_GO = ['GS', 'HG', 'PF', 'LU', 'ER', 'SOC2', 'ENV6', 'GEO2', 'GEO5']
SEUIL_NO_GO = 2.0

# --- CHARGEMENT DES DONNÃ‰ES AU DÃ‰MARRAGE ---
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
        profiles = {}
        files = {
            "indonesie": "profil_indonesie.csv",
            "philippines": "profil_philippines.csv",
            "barbade": "profil_barbade.csv"
        }
        
        for key, filename in files.items():
            path = os.path.join(DATA_DIR, filename)
            if os.path.exists(path):
                df = pd.read_csv(path)
                # On ne garde que l'essentiel : Code, Score, Poids base
                profiles[key] = df[['Code', 'Score ile (0-5)', 'Poids base', 'Critere', 'Thematique']].copy()
            else:
                print(f"âš ï¸ Fichier manquant: {filename}")

        return df_smr, smr_cols, profiles

    except Exception as e:
        print(f"Erreur au chargement des donnÃ©es: {e}")
        return None, [], {}

df_smr_global, smr_list_global, profiles_global = load_data()

# --- MODÃˆLES DE DONNÃ‰ES (Pydantic) ---
class CalculationRequest(BaseModel):
    island_id: str  # "indonesie", "philippines", "barbade"
    alpha: float = 0.3
    overrides: Optional[Dict[str, float]] = None # Ex: {"GEO1": 5.0}

class RankingItem(BaseModel):
    technologie: str
    score: float

class DisqualifiedItem(BaseModel):
    technologie: str
    score: float
    capex_score: Optional[float] = None
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
def get_islands():
    """Renvoie la liste des iles disponibles et leurs scores initiaux"""
    data = {}
    for island_id, df in profiles_global.items():
        # Convertit le DataFrame en dictionnaire simple {Code: Score}
        scores = dict(zip(df['Code'], df['Score ile (0-5)']))
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
    df_ile = profiles_global[req.island_id].copy()
    
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
    disqualified_capex = {}
    if req.island_id == "barbade":
        capex_row = df_smr_global[df_smr_global['Code'] == 'ECO3']
        if not capex_row.empty:
            capex_row = capex_row.iloc[0]
            for smr in smr_list_global:
                capex_score = pd.to_numeric(capex_row.get(smr), errors='coerce')
                capex_value = float(capex_score) if not pd.isna(capex_score) else 0.0
                if capex_value < 2:
                    disqualified_set.add(smr)
                    disqualified_capex[smr] = capex_value

    if total_weight == 0:
        total_weight = 1 # Ã‰viter division par zÃ©ro
        
    for smr in smr_list_global:
        # Nettoyage des scores SMR (valeurs non numÃ©riques -> 0)
        smr_scores = pd.to_numeric(df_calc[smr], errors='coerce').fillna(0)
        
        # Moyenne pondÃ©rÃ©e
        weighted_score = np.dot(smr_scores, df_calc['Poids_ajustÃ©']) / total_weight
        rounded_score = round(weighted_score, 2)

        if smr in disqualified_set:
            disqualified.append(
                DisqualifiedItem(
                    technologie=smr,
                    score=rounded_score,
                    capex_score=round(disqualified_capex.get(smr, 0.0), 2),
                    reason="CAPEX (ECO3) < 2"
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

