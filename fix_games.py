import re

with open('games.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'\s*<style>.*?</style>', '', content, flags=re.DOTALL)

new_nav = '''        <div class="nav-links">
            <a href="./index.html" class="nav-link">Lumi Chat</a>
            <a href="./resume.html" class="nav-link">Resume Scorer</a>
            <a href="./analytics.html" class="nav-link">AI Analytics</a>
            <a href="./avatar.html" class="nav-link">AI Avatar</a>
            <a href="./games.html" class="nav-link active">AI Games</a>
        </div>'''

content = re.sub(r'\s*<div class="module-dropdown">.*?(?=\s*</header>)', '\n' + new_nav, content, flags=re.DOTALL)

out_path = r'C:\Users\SunilKumarKethananei\.gemini\antigravity\brain\1cff23fe-8188-4939-8c4e-bef1b61b0b6e\games_fixed.html'
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done writing to artifact path")
