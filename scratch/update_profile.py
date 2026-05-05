import json
import os

pref_path = "/Users/francescoclaw/Library/Application Support/Google/Chrome/FrAssist/Default/Preferences"

if os.path.exists(pref_path):
    with open(pref_path, 'r') as f:
        prefs = json.load(f)
    
    if 'profile' not in prefs:
        prefs['profile'] = {}
    
    prefs['profile']['name'] = 'FrAssist'
    
    with open(pref_path, 'w') as f:
        json.dump(prefs, f)
    print("Profile name updated to FrAssist")
else:
    print("Preferences file not found")
