#import "@preview/cetz:0.3.2"

// ============================================================
// 图书馆自习座位智能预约系统
// 本科毕业设计（论文）Typst 源码
// 作者: 陈信豪
// 学号: 202231061133
// 指导教师: 梁宗文
// ============================================================

#set document(title: "图书馆自习座位智能预约系统", author: "陈信豪")

// 页面设置
#set page(
  paper: "a4",
  margin: (top: 2.5cm, bottom: 2.5cm, left: 3cm, right: 2.5cm),
)

// 字体设置（macOS 用 Songti SC / PingFang SC 回退，Windows 用 SimSun）
#set text(font: ("Times New Roman", "Songti SC", "PingFang SC", "SimSun"), size: 12pt, lang: "zh")

// 行距：固定值22磅（约1.52倍）
#set par(leading: 1.52em, justify: true, first-line-indent: 2em)

// 标题编号与格式
#set heading(numbering: "1.1")
#show heading.where(level: 1): it => {
  pagebreak(weak: true)
  align(center)[
    #text(font: ("Times New Roman", "SimSun"), size: 16pt, weight: "bold")[
      #it.body
    ]
  ]
  v(1em)
}
#show heading.where(level: 2): it => {
  text(font: ("Times New Roman", "SimSun"), size: 15pt, weight: "bold")[
    #it
  ]
  v(0.5em)
}
#show heading.where(level: 3): it => {
  text(font: ("Times New Roman", "SimSun"), size: 14pt, weight: "bold")[
    #it
  ]
  v(0.3em)
}

// 图表编号
#show figure.where(kind: image): set figure(supplement: "图", numbering: "1.1")
#show figure.where(kind: table): set figure(supplement: "表", numbering: "1.1")

// 代码块样式
#show raw.where(block: true): it => {
  block(
    fill: luma(250),
    stroke: 0.5pt + luma(200),
    radius: 4pt,
    inset: 8pt,
    width: 100%,
    breakable: true,
    text(size: 10pt, font: "Consolas")[#it]
  )
}

// 允许代码清单跨页断开，但图片和表格保持单页
#show figure: set block(breakable: true)
#show figure.where(kind: image): set block(breakable: false)
#show figure.where(kind: table): set block(breakable: false)

// 页眉页脚
#set page(header: [
  #align(center)[
    #text(size: 10.5pt)[
      #context {
        if calc.odd(counter(page).get().first()) {
          [图书馆自习座位智能预约系统]
        } else {
          [西南石油大学本科毕业设计（论文）]
        }
      }
    ]
  ]
  #line(length: 100%, stroke: 0.4pt)
], footer: [
  #align(center)[
    #context {
      text(size: 10.5pt)[#counter(page).display("1")]
    }
  ]
])

// ====================== 中文封面 ======================
#page(footer: [])[
  #align(center)[
    #image("figures/school_signature.png", width: 70%)
    #v(0.5cm)
    #text(size: 22pt, weight: "bold")[本科毕业设计（论文）]
    #v(2cm)
    #image("figures/school_badge.png", width: 25%)
    #v(2cm)

    #let coverlabel(t) = align(right)[#text(size: 14pt, weight: "bold")[#t]]
    #let coverunderline(w, content) = underline(offset: 4pt)[#align(center)[#box(width: w)[#content]]]

    #grid(
      columns: (2.5cm, 4.5cm, 2.5cm, 4.5cm),
      row-gutter: 1.2em,
      gutter: 0.5cm,
      coverlabel("题　　目"), grid.cell(colspan: 3, coverunderline(10cm, text(size: 16pt, weight: "bold")[图书馆自习座位智能预约系统])),
      coverlabel("学生姓名"), coverunderline(4cm, [陈信豪]), coverlabel("学　　号"), coverunderline(4cm, [202231061133]),
      coverlabel("教学院系"), grid.cell(colspan: 3, coverunderline(10cm, [计算机与软件学院])),
      coverlabel("专业年级"), grid.cell(colspan: 3, coverunderline(10cm, [物联网工程2022级])),
      coverlabel("指导教师"), coverunderline(4cm, [梁宗文]), coverlabel("职　　称"), coverunderline(4cm, [讲师]),
      coverlabel("单　　位"), grid.cell(colspan: 3, coverunderline(10cm, [西南石油大学])),
      coverlabel("辅导教师"), coverunderline(4cm, []), coverlabel("职　　称"), coverunderline(4cm, []),
      coverlabel("单　　位"), grid.cell(colspan: 3, coverunderline(10cm, [])),
    )
    #v(2cm)
    #text(size: 14pt, weight: "bold")[
      完成日期　2026　年　05　月　11　日
    ]
  ]
]

// ====================== 英文封面 ======================
#page(footer: [])[
  #align(center)[
    #text(size: 22pt, weight: "bold", font: "Times New Roman")[Southwest Petroleum University]
    #v(1cm)
    #text(size: 22pt, weight: "bold", font: "Times New Roman")[Graduation Thesis]
    #v(1.5cm)
    #image("figures/school_badge.png", width: 25%)
    #v(1.5cm)
    #text(size: 18pt, weight: "bold", font: "Times New Roman")[
      Intelligent Reservation System\
      for Library Study Seats
    ]
    #v(2cm)
  ]

  #h(3cm)
  #grid(
    columns: (1fr),
    row-gutter: 0.8cm,
    text(size: 15pt, weight: "bold", font: "Times New Roman")[Grade: 　2022],
    text(size: 15pt, weight: "bold", font: "Times New Roman")[Name: 　Chen Xinhao],
    text(size: 15pt, weight: "bold", font: "Times New Roman")[Specialty: 　Internet of Things Engineering],
    text(size: 15pt, weight: "bold", font: "Times New Roman")[Instructor: 　Liang Zongwen],
  )

  #v(2cm)
  #align(center)[
    #text(size: 15pt, weight: "bold", font: "Times New Roman")[
      School of Computer Science and Software Engineering
    ]
    #v(0.5cm)
    #text(size: 15pt, weight: "bold", font: "Times New Roman")[2026-5]
  ]
]

// ====================== 摘要 ======================
#include "chapters/abstract.typ"

// ====================== 目录 ======================
#page(footer: [])[
  #align(center)[
    #text(size: 16pt, weight: "bold")[目　　录]
  ]
  #v(1em)
  #outline(
    title: none,
    indent: auto,
  )
]

// ====================== 正文 ======================
#include "chapters/chapter1.typ"
#include "chapters/chapter2.typ"
#include "chapters/chapter3.typ"
#include "chapters/chapter4.typ"
#include "chapters/chapter5.typ"
#include "chapters/chapter6.typ"

// ====================== 参考文献 ======================
#bibliography("refs.bib", title: [参考文献], style: "gb-7714-2015-numeric")

// ====================== 致谢 ======================
#include "chapters/acknowledgements.typ"
