MoneyStream — Permanent Design Reference
Primary Visual Reference
The file moneystream-dashboard-reference.png is the official visual reference for the
MoneyStream application.
This image establishes the intended visual identity, layout, proportions, colors, spacing,
typography, and overall user experience.
Mandatory Design Requirements
Whenever developing or modifying MoneyStream’s frontend:
1. Refer to the official dashboard reference image called moneystreaminspo.png
2. Maintain the established emerald green and white color scheme.
3. Maintain consistent card styling, rounded corners, borders, and shadows.
4. Maintain the established sidebar and navigation structure.
5. Maintain consistent typography and financial data presentation.
6. Do not independently redesign existing components without a reason.
7. New pages must follow the same design language.
8. New components must visually integrate with the existing dashboard.
9. Avoid introducing unrelated colors, layouts, or visual styles.
10. Prioritize consistency across the entire application.
Official Color Palette
● Primary Emerald: #075E38
● Secondary Green: #12834A
● Accent Green: #16A05A
● Light Mint: #DDF5E6
● Background: #F7FAF8
● Card Background: #FFFFFF
● Primary Text: #111827
● Secondary Text: #64748B
● Borders: #E5EAE7
Design Consistency
The dashboard reference is the source of truth for the visual direction.
When implementing new features, preserve the established MoneyStream design system.
Do not allow individual pages to develop inconsistent styling.

Before considering frontend work complete, compare the implementation against the official
reference image.
The objective is to maintain one cohesive, professional financial application.
.github/copilot-instructions.md
MoneyStream — GitHub Copilot Instructions
Before making any frontend changes, read:
docs/design/DESIGN-GUIDELINES.md
The official visual reference is:
docs/design/moneystream-dashboard-reference.png
Treat these files as the permanent design requirements for MoneyStream.
All new pages, components, and frontend modifications must follow the established
MoneyStream design system.
Do not introduce a new visual identity or independently redesign existing components.
Preserve the existing application architecture and phased development strategy.
Current development strategy:
● Frontend development first.
● Browser-based IndexedDB persistence.
● No SQL database or backend implementation yet.
● Future Plaid integration compatibility.
● Future migration to secure SQL-backed storage.
Always respect these requirements when modifying the project.
