FJ DIAGNOSTIC LABORATORY - CLINICIQ (DESKTOP)

Ky projekt eshte konfiguruar per perdorim lokal ne kompjuterin tuaj Windows.
Serveri lidhet vetem me 127.0.0.1, prandaj nuk publikohet ne internet dhe nuk hapet nga kompjutere te tjere ne rrjet.

NISJA:
1. Nxirre ZIP-in ne nje folder te zakonshem ne Desktop (mos e hap brenda ZIP-it).
2. Instalo Node.js LTS nese nuk eshte instaluar: https://nodejs.org/
3. Kliko dy here START-CLINICIQ.bat.
4. Herën e pare duhet internet per instalimin e Express.
5. Hapet shfletuesi ne http://127.0.0.1:3000.
6. Per ta ndalur serverin, kthehu te dritarja e zeze dhe shtyp Ctrl+C.

KYÇJA FILLESTARE:
Perdoruesi: admin2
Fjalekalimi: clinic1
Ndrysho kredencialet para perdorimit me te dhena reale. Platforma eshte lokale; kjo paketë nuk eshte hostuar publikisht ne internet.

NDRYSHIMET E SHTUARA:
- Logoja e FJ Diagnostic Laboratory ne raportin e printuar.
- Rezultate te vecanta per cdo analize te vizites, me ruajtje ne databaze dhe mundesi rihapjeje.
- Data dhe ora e vizites ruhen ne momentin e regjistrimit; raporti perdor oren e vizites, jo oren e printimit.
- Fusha e zbritjes ne euro, shuma e paguar, pagesa Cash dhe borxhi i mbetur.
- Raport printimi A4 me fusha per vulen/nenshkrimin e specialistes dhe laborantit.
- Serveri kufizohet ne localhost per perdorim vetem ne kete kompjuter.

TE DHENAT:
Databaza ekzistuese ruhet ne data/cliniciq-db.json. Kopja rezervë eshte data/cliniciq-db.backup.json.
Para se te zevendesosh ndonje nga keto skedare, mbylle serverin dhe bej nje kopje te folderit data.
Mos e fshi folderin data. Ruajtja e rezultateve dhe vizitave behet aty.

SHENIM:
Ky projekt eshte kontrolluar per sintakse JavaScript dhe konfigurim te serverit. Para perdorimit klinik, testoni me vizita prove dhe verifikoni vlerat referente, raportin dhe printerin. Vlerat referente qe mungojne ne listen ekzistuese shfaqen bosh; mos i konsideroni te plotesuara automatikisht.
