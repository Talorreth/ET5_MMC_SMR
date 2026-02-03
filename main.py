import os
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MCDA Nucléaire API")

# Configuration CORS pour autoriser le futur Frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # À restreindre en prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURATION GLOBALE ---
DATA_DIR = "data"
CRITERES_NO_GO = ['GS', 'HG', 'PF', 'LU', 'ER', 'SOC2', 'ENV6', 'GEO2', 'GEO5']
SEUIL_NO_GO = 2.0

# --- CHARGEMENT DES DONNÉES AU DÉMARRAGE ---
def load_data():
    try:
        # 1. Chargement des scores SMR
        smr_path = os.path.join(DATA_DIR, "scoring_smr.csv")
        df_smr = pd.read_csv(smr_path)
        
        # Nettoyage des noms de colonnes SMR
        # On identifie les colonnes SMR (toutes sauf les métadonnées)
        meta_cols = ['Thematique', 'Code', 'Critere', 'Explications', 'Inclure_ranking_SMR (0/1)', 'Justification / source']
        smr_cols = [c for c in df_smr.columns if c not in meta_cols]
        
        # 2. Chargement des profils îles
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
                print(f"⚠️ Fichier manquant: {filename}")

        return df_smr, smr_cols, profiles

    except Exception as e:
        print(f"Erreur au chargement des données: {e}")
        return None, [], {}

df_smr_global, smr_list_global, profiles_global = load_data()

# --- MODÈLES DE DONNÉES (Pydantic) ---
class CalculationRequest(BaseModel):
    island_id: str  # "indonesie", "philippines", "barbade"
    alpha: float = 0.3
    overrides: Optional[Dict[str, float]] = None # Ex: {"GEO1": 5.0}

class RankingItem(BaseModel):
    technologie: str
    score: float

class CalculationResponse(BaseModel):
    island_id: str
    is_nogo: bool
    nogo_reasons: List[str]
    ranking: List[RankingItem]

# --- ENDPOINTS ---

@app.get("/")
def read_root():
    return {"status": "API MCDA Nucléaire opérationnelle"}

@app.get("/islands")
def get_islands():
    """Renvoie la liste des îles disponibles et leurs scores initiaux"""
    data = {}
    for island_id, df in profiles_global.items():
        # Convertit le DataFrame en dictionnaire simple {Code: Score}
        scores = dict(zip(df['Code'], df['Score île (0-5)']))
        data[island_id] = scores
    return data

@app.get("/criteria")
def get_criteria():
    """Renvoie la liste des critères (Code, Nom, Thématique) pour l'UI"""
    # On prend le fichier SMR comme référence pour les critères
    df = df_smr_global[['Code', 'Critère', 'Thématique', 'Inclure_ranking_SMR (0/1)']]
    return df.to_dict(orient="records")

@app.post("/calculate", response_model=CalculationResponse)
def calculate(req: CalculationRequest):
    """
    Cœur du réacteur : Recalcule le classement en fonction des inputs
    """
    if req.island_id not in profiles_global:
        raise HTTPException(status_code=404, detail="Île inconnue")

    # 1. Récupération du profil de base
    df_ile = profiles_global[req.island_id].copy()
    
    # 2. Application des Overrides (Modifications utilisateur)
    if req.overrides:
        for code, new_score in req.overrides.items():
            # Mise à jour du score dans la ligne correspondante
            df_ile.loc[df_ile['Code'] == code, 'Score île (0-5)'] = new_score

    # 3. Préparation des données SMR (Filtre des critères actifs)
    # On ne garde que les critères marqués "1" dans Inclure_ranking
    active_criteria_codes = df_smr_global[df_smr_global['Inclure_ranking_SMR (0/1)'] == 1]['Code'].tolist()
    
    # Fusionner Profil Île + Scores SMR
    # On merge sur 'Code'
    df_merged = pd.merge(
        df_ile, 
        df_smr_global[['Code'] + smr_list_global], 
        on='Code', 
        how='inner'
    )
    
    # Filtrer pour ne garder que les critères actifs pour le calcul
    df_calc = df_merged[df_merged['Code'].isin(active_criteria_codes)].copy()

    # 4. Calculs des Poids (Logique Excel)
    # Besoin = (5 - Score) / 5
    df_calc['Besoin'] = (5 - df_calc['Score île (0-5)']) / 5
    
    # Poids Ajusté = Poids_base * (Alpha + (1-Alpha) * Besoin)
    df_calc['Poids_ajusté'] = df_calc['Poids base'] * (req.alpha + (1 - req.alpha) * df_calc['Besoin'])
    
    # 5. Détection Hard No-Go
    # On vérifie sur TOUS les critères fusionnés (même ceux exclus du ranking s'ils sont critiques ?)
    # Par sécurité, on vérifie sur df_merged (tous les critères dispos)
    is_nogo = False
    reasons = []
    
    for _, row in df_merged.iterrows():
        if row['Code'] in CRITERES_NO_GO:
            if row['Score île (0-5)'] < SEUIL_NO_GO:
                is_nogo = True
                reasons.append(f"{row['Critère']} (Score: {row['Score île (0-5)']})")

    # 6. Calcul des Scores SMR
    ranking = []
    total_weight = df_calc['Poids_ajusté'].sum()
    
    if total_weight == 0:
        total_weight = 1 # Éviter division par zéro
        
    for smr in smr_list_global:
        # Nettoyage des scores SMR (valeurs non numériques -> 0)
        smr_scores = pd.to_numeric(df_calc[smr], errors='coerce').fillna(0)
        
        # Moyenne pondérée
        weighted_score = np.dot(smr_scores, df_calc['Poids_ajusté']) / total_weight
        ranking.append(RankingItem(technologie=smr, score=round(weighted_score, 2)))
        
    # Tri décroissant
    ranking.sort(key=lambda x: x.score, reverse=True)

    return CalculationResponse(
        island_id=req.island_id,
        is_nogo=is_nogo,
        nogo_reasons=reasons,
        ranking=ranking
    )

if __name__ == "__main__":
    import uvicorn
    # Lance le serveur en mode dev (auto-reload)
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)