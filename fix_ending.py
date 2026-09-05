with open('frontend/src/components/GuardrailsDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

bad_ending = """                </div>
              )}
            </div>

          </div>
        )}
      </div>

          </div>
  );
};

export default GuardrailsDashboard;"""

good_ending = """                </div>
              )}
            </div>
    </div>
  );
};

export default GuardrailsDashboard;"""

content = content.replace(bad_ending, good_ending)

# Just in case whitespace was different
import re
content = re.sub(r'            </div>\s*</div>\s*\)\}\s*</div>\s*</div>\s*\);\s*\};\s*export default GuardrailsDashboard;',
                 '            </div>\n    </div>\n  );\n};\n\nexport default GuardrailsDashboard;\n',
                 content)

with open('frontend/src/components/GuardrailsDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed ending.")
