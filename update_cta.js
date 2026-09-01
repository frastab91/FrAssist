const fs = require('fs');
const path = '/Users/francescostabilito/Desktop/Progetti/host-new/components/CTASection.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  '<motion.a\n          href="#"\n          className={styles.contributeLink}\n          whileHover={{ x: 5 }}\n        >BUILD WITH ME →</motion.a>',
  '<motion.a\n          href="https://www.facebook.com/groups/1368256701573163"\n          target="_blank"\n          rel="noopener noreferrer"\n          className={styles.contributeLink}\n          whileHover={{ x: 5 }}\n        >BUILD TOGETHER →</motion.a>'
);

content = content.replace(
  '<p className={styles.footerText}>WE BUILD IT TOGETHER.</p>',
  '<a href="https://www.facebook.com/groups/1368256701573163" target="_blank" rel="noopener noreferrer" className={styles.footerText}>WE BUILD IT TOGETHER.</a>'
);

fs.writeFileSync(path, content);
console.log("Updated CTASection.js");
