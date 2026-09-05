with open('frontend/src/components/GuardrailsDashboard.tsx', 'r', encoding='utf-8') as f:
    g_out = f.read()

# Fix the `}}` syntax error
g_out = g_out.replace('              </div>}}', '              </div>')

# Truncate at Model Feature Importance Ranks
idx = g_out.find('{/* Model Feature Importance Ranks */}')
if idx != -1:
    g_out = g_out[:idx] + "    </div>\n  );\n};\n\nexport default GuardrailsDashboard;\n"

with open('frontend/src/components/GuardrailsDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(g_out)
print("Fixed GuardrailsDashboard syntax!")
