import sys

path = '/Users/francescostabilito/Desktop/Progetti/host-new/components/CTASection.js'
with open(path, 'r') as f:
    content = f.read()

content = content.replace(
    '<motion.a\n          href="#"\n          className={styles.contributeLink}\n          whileHover={{ x: 5 }}\n        >BUILD WITH ME →</motion.a>',
    '<motion.a\n          href="https://www.facebook.com/groups/1368256701573163"\n          target="_blank"\n          rel="noopener noreferrer"\n          className={styles.contributeLink}\n          whileHover={{ x: 5 }}\n        >BUILD TOGETHER →</motion.a>'
)

content = content.replace(
    '<p className={styles.footerText}>WE BUILD IT TOGETHER.</p>',
    '<a href="https://www.facebook.com/groups/1368256701573163" target="_blank" rel="noopener noreferrer" className={styles.footerText} style={{ textDecoration: "none" }}>WE BUILD IT TOGETHER.</a>'
)

with open(path, 'w') as f:
    f.write(content)
print('Updated CTASection.js')
