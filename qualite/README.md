# Examen qualité

Luka passe un examen : de vraies demandes, dans tous les secteurs (lieux, publications, organisations,
personnes, statistiques, événements, textes officiels, produits, culture), avec ce qu'une bonne réponse
doit contenir. On le relance après chaque amélioration : si la note monte, l'amélioration marche ; si une
note baisse ailleurs, quelque chose a été cassé.

```bash
npm run qualite                              # toutes les questions (30 à 40 min)
npm run qualite -- --cas=banques-congo       # une ou plusieurs questions (séparées par des virgules)
npm run qualite -- --forme=publications      # une seule forme
npm run qualite -- --premium                 # formule Premium : Google Maps (payant, plafond APIFY_MAX_USD_PER_COLLECTE)
```

- Il faut Docker et `.env.local` (clés de l'IA, de la recherche web et d'OpenAlex). Les collectes appellent les
  vrais services : un passage complet consomme environ 50 crédits de recherche web.
- La base est jetable (conteneur `luka-qualite`, supprimé à la fin) ; aucun e-mail n'est envoyé.
- Chaque passage écrit un rapport dans `qualite/resultats/` (non versionné) et le compare au précédent.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `cas.ts` | les questions et leurs attentes |
| `evaluer.ts` | la note d'une réponse |
| `lancer.mts` | fait passer l'examen et écrit le rapport |

## La note

Chaque question a quelques vérifications ; sa note est la part de vérifications réussies :

- **lignes** : au moins le nombre attendu ;
- **source** : au moins une ligne vient de la source attendue (OpenAlex, OpenStreetMap…) ;
- **colonne** : la colonne est remplie dans la part attendue des lignes ;
- **contient** : un nom connu apparaît dans au moins une ligne (« A|B » accepte l'un ou l'autre).

Le rapport donne aussi la part de **lignes sourcées** (qui citent une page, une base ou une carte plutôt que
les seules connaissances du modèle) et les **alertes** du journal de chaque collecte.

## Ajouter une question

Dans `cas.ts`, choisis des attentes **stables et vérifiables** : des noms qui ne changeront pas (« Marien
Ngouabi »), une source attendue, un minimum de lignes réaliste. Une attente trop précise (un prix, un
classement) rendrait l'examen faux à la première actualité.
