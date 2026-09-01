# Tra-Montiemare: Strategic Editorial Plan (Scalea, Calabria)

## Objective
Establish [Tra-Montiemare](https://tra-montiemare.it) as the definitive digital resource for travelers, remote workers, and culture enthusiasts visiting Scalea, the Riviera dei Cedri, and Calabria.

---

## Content Pillars & Editorial Calendar

### 1. Secret Spots & Riviera dei Cedri Exploration
- **Article 1**: *10 Local Secret Spots in Scalea & the Riviera dei Cedri*
  - **Keywords**: `Scalea hidden gems`, `Riviera dei Cedri beaches`, `Calabria travel guide`
  - **Focus**: Ajnella cove, Torre Talao history, panoramic terraces of the Centro Storico, cliff jumping near San Nicola Arcella.
- **Article 2**: *The Ultimate Day Trip: From Scalea to Arco Magno & Isola di Dino*
  - **Keywords**: `Arco Magno San Nicola Arcella`, `Isola di Dino boat tour`, `Praia a Mare caves`
  - **Focus**: Kayaking routes, sea caves, best photography angles, timing to avoid summer crowds.

### 2. Digital Nomad & Remote Living in Southern Italy
- **Article 3**: *High-Speed Work & Slow Living: The Remote Worker’s Guide to Scalea*
  - **Keywords**: `Remote work Calabria`, `Scalea digital nomad`, `Italy workation rental`
  - **Focus**: Internet speeds, workstation setups at Tra-Montiemare (Piano 1 & Attico), local cafes with WiFi, English/Italian community meetups.
- **Article 4**: *Cost of Living in Southern Italy vs. Major Cities: A Real Breakdown*
  - **Keywords**: `Cost of living Calabria`, `cheap living in Italy`, `Scalea expat living`
  - **Focus**: Grocery markets, dining out, utilities, train access, rent savings.

### 3. Food, Wine & Cultural Traditions
- **Article 5**: *A Food Lover’s Guide to Scalea: Cedro, Peperoncino & Authentic Trattorias*
  - **Keywords**: `Calabrian food guide`, `Cedro di Santa Maria del Cedro`, `Scalea restaurants`
  - **Focus**: Citron liqueur & marmalades, pasta with swordfish and eggplant, Nduja pairings, weekly Thursday open-air market.

### 4. Off-Season & Slow Travel
- **Article 6**: *Why Autumn & Spring in Calabria Beat Peak Summer*
  - **Keywords**: `Calabria off-season`, `Autumn in Southern Italy`, `Scalea peaceful vacation`
  - **Focus**: Mild climate, uncrowded beaches, truffle and mushroom foraging in the Pollino mountains, wine harvest season.

---

## SEO & Publishing Protocol
1. **Schema Markup**: Article & VacationRental JSON-LD tags.
2. **Internal CTAs**: Deep link to apartment bookings (`/apartments/piano-1`, `/apartments/attico`).
3. **Distribution**: Direct upload to Supabase `blog_posts` table + live Telegram alert.

## Facebook Graph API Publishing — VERIFIED (2026-08-31)
- **Page ID**: 821714194348175 (TraMonti e Mare)
- **Credentials location**: `/Users/francescostabilito/Desktop/Progetti/FrAssist/backend/.env` (`FB_PAGE_ACCESS_TOKEN`, `FB_PAGE_ID`, `FB_PROFILE_ID=61579832417650`)
- **API Version**: Graph API v22.0
- **Photo post publishing works**: `POST /v22.0/{page-id}/photos` with `published=true`, `source=@file` (multipart), caption via `--form-string`.
- **Gotcha**: `-F "caption=<file"` fails with curl error 26 on paths containing spaces; use `--form-string` for caption text.
- **Successful test**: Photo `IMG_3563 2.JPG` from `casa-sopra`, post ID `821714194348175_122152925966994413`, published 2026-08-31T01:43:37Z. Caption: warm sea-view intro + hashtags (#Scalea #Calabria #SeaView #VacationRental #TraMontieMare).
- **Verification method**: GET `/v22.0/{post_id}?fields=id,message,created_time,permalink_url,is_published` returned `is_published: true`.

## Image-Matched Caption Policy (2026-08-31, Francesco's directive)
1. **Never post a caption not matched to the image content.** Every photo MUST be visually understood (multimodal analysis) before captioning.
2. **Media folders**: `/Users/francescostabilito/Desktop/Media casa/casa-sopra/` (22 files: sea-view terraces, bedrooms, bathrooms, kitchen, door details) and `/Users/francescostabilito/Desktop/Media casa/casa-sotto/`.
3. **Analysis method**: Use `qwen2.5-coder:14b` via local Ollama vision fallback OR describe from known room-by-room catalog. For guaranteed accuracy, Francesco reviews each caption+image pairing before publish.
4. **Unique assets preference**: Use our own photos first ("unique things"), stock/web images only as fallback (via `search_images` with downloadLocal, crediting not needed for FB but keep authentic).
5. **Weekly plan**: Draft full week (7 posts) as table (Day | Image (local path) | Image content | Caption draft | Hashtags), get Francesco's approval, then schedule/publish one per day.