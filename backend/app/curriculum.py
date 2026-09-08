"""Authored teaching material aligned to the imported roadmap, not verbatim source text."""
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEEKS = json.loads((ROOT / 'data' / 'roadmap.json').read_text(encoding='utf-8'))
RESOURCES = [
    {'id': 'R1', 'title': 'Python tutorial', 'url': 'https://docs.python.org/3/tutorial/'},
    {'id': 'R2', 'title': 'PostgreSQL tutorial', 'url': 'https://www.postgresql.org/docs/current/tutorial.html'},
    {'id': 'R3', 'title': 'NumPy learning resources', 'url': 'https://numpy.org/learn/'},
    {'id': 'R4', 'title': 'pandas introductory tutorials', 'url': 'https://pandas.pydata.org/docs/getting_started/intro_tutorials/index.html'},
    {'id': 'R5', 'title': 'Mathematics for Machine Learning', 'url': 'https://mml-book.github.io/'},
    {'id': 'R6', 'title': 'Google Machine Learning Crash Course', 'url': 'https://developers.google.com/machine-learning/crash-course/'},
]


def question(prompt, options, correct, explanation):
    return {'prompt': prompt, 'options': options, 'correct': correct, 'explanation': explanation}


def lesson(id, week, title, objective, diagnostic, explanation, example, exercise, mistakes, questions, refs, language='python'):
    return dict(id=id, week=week, title=title, objective=objective, diagnostic=diagnostic,
                explanation=explanation, example=example, exercise=exercise,
                common_mistakes=mistakes, questions=questions, resource_ids=refs, language=language,
                minutes=25, source_id=f'roadmap-w{week}',
                completion_criteria='Score at least 80% on the lesson quiz. Practical work remains self-reported until independently reviewed.')


LESSONS = [
    lesson('python-functions', 1, 'Functions & data structures',
        'Separate validation from transformation using small, testable Python functions.',
        'What should a function do when a booking contains a negative number of nights?',
        'A function should have one clear job. Validate a value at the boundary, then return a predictable result. A dictionary maps names to values; a set stores unique values; a list preserves a sequence. Type hints explain an interface but do not validate runtime input. Comprehensions work well for short transformations; use a loop when error handling needs several steps.',
        'def booking_total(nights: int, rate: float) -> float:\n    if nights < 0 or rate < 0:\n        raise ValueError("Expected non-negative values")\n    return nights * rate\n\nassert booking_total(3, 1200) == 3600',
        'Write clean_tags(values) to trim and lowercase strings, discard empty strings, and return unique tags in first-seen order. State your policy for non-string input and test it.',
        ['Confusing type hints with validation.', 'Using a set when first-seen order is required.', 'Catching every exception and returning a plausible value.'],
        [question('Which structure directly represents unique membership?', ['List', 'Set', 'Float'], 1, 'Sets represent unique values and support membership checks.'),
         question('What does a type hint enforce at runtime by itself?', ['Input validation', 'Automatic conversion', 'Nothing; add validation when needed'], 2, 'Annotations document types; Python does not enforce them automatically.'),
         question('Typical average membership lookup cost in a Python set?', ['O(1)', 'O(n)', 'O(n squared)'], 0, 'Hash-based set membership is O(1) on average, though worst cases differ.')], ['R1']),
    lesson('python-files', 1, 'Files, exceptions & environments',
        'Read structured input and report failures without silently losing records.',
        'How would you distinguish an empty file from a row containing an invalid number?',
        'Use a context manager to close files even when parsing fails. CSV fields arrive as text, so validate required columns before converting rows. Catch specific conversion exceptions, record the row number, and keep successful output separate from rejected records. Put reusable code in modules. An isolated virtual environment and dependency file make your tools easier to reproduce; logging records what happened without hiding errors.',
        'import csv\n\nwith open("bookings.csv", newline="", encoding="utf-8") as source:\n    reader = csv.DictReader(source)\n    if not reader.fieldnames or "nights" not in reader.fieldnames:\n        raise ValueError("Missing nights column")\n    for row_number, row in enumerate(reader, start=2):\n        try:\n            nights = int(row["nights"])\n        except (ValueError, TypeError):\n            print(f"Invalid nights at row {row_number}")',
        'Design a CSV cleaner requiring booking_id and nights. Return clean rows and a separate list of row-numbered errors. Describe what happens for an empty file, missing headers, and negative nights.',
        ['Assuming a valid integer is automatically a valid domain value.', 'Using bare except.', 'Overwriting the original input file.'],
        [question('Why use with open(...) ?', ['It validates CSV values', 'It closes the file on exit, including errors', 'It installs dependencies'], 1, 'A context manager releases the file resource.'),
         question('int("unknown") raises which exception?', ['ValueError', 'KeyError', 'No exception'], 0, 'The string exists but cannot be parsed as an integer.'),
         question('What is a virtual environment for?', ['Encrypting source', 'Running unsafe code safely', 'Isolating project packages'], 2, 'Virtual environments isolate dependencies; they are not execution sandboxes.')], ['R1']),
    lesson('python-tests', 1, 'Tests & reliable scripts',
        'Write assertions for normal, empty, boundary, and invalid inputs.',
        'A CSV cleaner works on your sample file. What would you test before trusting it?',
        'A useful test checks an observable result or a failure contract. Include one normal case, an empty case, a boundary, and malformed input. Keep parsing and transformation separate so pure functions are easy to test. Use a main guard to prevent a script from running when imported. Log counts of accepted and rejected records; do not log secrets or personal rows unnecessarily.',
        'import unittest\n\ndef positive_count(value):\n    count = int(value)\n    if count < 0:\n        raise ValueError("Negative count")\n    return count\n\nclass CountTests(unittest.TestCase):\n    def test_zero(self):\n        self.assertEqual(positive_count("0"), 0)\n\n    def test_invalid(self):\n        with self.assertRaises(ValueError):\n            positive_count("unknown")',
        'Write tests for your CSV cleaner: empty file, missing nights header, invalid numeric value, zero nights, and a normal row. Explain the expected result for each before writing assertions.',
        ['Testing only the happy path.', 'Asserting the same formula as the implementation.', 'Allowing imports to trigger file writes.'],
        [question('Which assertion tests a failure contract?', ['The function has a docstring', 'Invalid input raises the agreed error', 'The source contains a loop'], 1, 'Test public behavior, including agreed failures.'),
         question('Which is a boundary case for non-negative nights?', ['A random positive number only', 'The filename', 'Zero nights'], 2, 'Zero is the lower valid boundary.'),
         question('Why use if __name__ == "__main__"?', ['Avoid running the script entry point on import', 'Automatically run all tests', 'Make every function private'], 0, 'The guard distinguishes direct execution from import.')], ['R1']),
    lesson('numpy-shapes', 2, 'Arrays, shapes & vectorisation',
        'Predict array shapes and use broadcasting deliberately.',
        'If X contains 100 bookings and 4 features, what is its shape?',
        'A NumPy array has a shape describing its dimensions. For X with shape (100, 4), rows are bookings and columns are features. Broadcasting compares dimensions from the right; dimensions are compatible if they match or one is 1. Vectorised operations move loops into array operations, but an unexpected extra axis can silently produce a much larger result.',
        'import numpy as np\n\nX = np.array([[2., 100.], [3., 150.], [1., 80.]])\nmeans = X.mean(axis=0)  # shape (2,)\ncentered = X - means   # shape (3, 2)\nprint(centered.shape)',
        'Create a (4, 3) array of four bookings and three features. Subtract each column mean without a Python loop. Print the input, mean, and output shapes, and explain why broadcasting works.',
        ['Confusing rows with columns.', 'Using * when matrix multiplication is intended.', 'Accidentally broadcasting (n, 1) against (n,) to get (n, n).'],
        [question('Shape of 100 rows and 4 feature columns?', ['(4, 100)', '(100, 4)', '(104,)'], 1, 'Rows come first, columns second.'),
         question('Shape of (4, 3) minus its column means of shape (3,)?', ['(4, 3)', '(3, 4)', 'Always invalid'], 0, 'The trailing dimension matches and the missing leading dimension broadcasts.'),
         question('Which operator performs matrix multiplication for NumPy arrays?', ['*', '+', '@'], 2, '@ performs matrix multiplication; * is elementwise.')], ['R3']),
    lesson('pandas-quality', 2, 'pandas & data quality',
        'Audit missing values, duplicate keys, dates, and grouped summaries.',
        'Why might two identical-looking booking rows still not be safe to delete?',
        'Start by inspecting shape, types, missingness, and the meaning of one row. A duplicate booking key may indicate an accidental repeat or a valid update; choose a rule using the data contract. Parse dates explicitly and report failures. A grouped mean excludes missing values by default, so report counts alongside it. Label each chart with units and the population it describes.',
        'import pandas as pd\n\ndf = pd.DataFrame({"hotel": ["City", "City", "Resort"],\n                   "nights": [2., None, 5.]})\nprint(df.isna().sum())\nsummary = df.groupby("hotel")["nights"].agg(["count", "mean"])\nprint(summary)',
        'Audit a booking table: types, missing values, duplicate booking IDs, and invalid arrival dates. Produce a grouped count and mean plus three labelled charts. State every cleaning rule.',
        ['Dropping missing values without reporting the effect.', 'Treating repeated keys as identical records.', 'Reporting an average without its non-missing count.'],
        [question('What should guide duplicate removal?', ['Always keep the last row', 'Delete every repeated value', 'The meaning of the key and record'], 2, 'A record may be a snapshot, event, or update; the rule depends on that meaning.'),
         question('Why include count alongside a grouped mean?', ['It shows how many non-missing values support the mean', 'It proves causation', 'It fills missing values'], 0, 'Small or missing-heavy groups can make averages misleading.'),
         question('A date parse produces missing timestamps. What next?', ['Ignore them', 'Count and inspect failures before choosing a policy', 'Replace all with today'], 1, 'First understand why parsing failed and report its impact.')], ['R4']),
    lesson('sql-analysis', 2, 'Joins & analytical SQL',
        'Reconcile pandas summaries with SQL and use windows without collapsing rows.',
        'How does a window function differ from GROUP BY?',
        'A join combines rows using keys; a one-to-many join can multiply rows and inflate aggregates. GROUP BY collapses a group into summary rows. A window function computes across related rows while retaining individual rows. CTEs name intermediate results to make a query readable. Reconcile filters, missing-value handling, and join cardinality when comparing SQL with pandas.',
        'WITH valid_bookings AS (\n  SELECT hotel_id, nights\n  FROM bookings\n  WHERE nights >= 0\n)\nSELECT hotel_id, nights,\n       AVG(nights) OVER (PARTITION BY hotel_id) AS hotel_avg\nFROM valid_bookings;',
        'Write queries for a total count, a grouped average, a left join to hotels, and a row number per hotel ordered by arrival date. Expand to ten queries. Reconcile a count and an average with pandas.',
        ['Ignoring row multiplication after joins.', 'Comparing COUNT(*) with a non-null column count.', 'Using a window without a deterministic tie-breaker when order matters.'],
        [question('A window function usually does what to individual rows?', ['Keeps them while adding a calculation', 'Always collapses them', 'Deletes duplicates'], 0, 'Window calculations retain each input row.'),
         question('Why might a join inflate a sum?', ['SQL always rounds up', 'Missing ORDER BY', 'Multiple matching rows duplicate each input value'], 2, 'Join cardinality affects how many times a value is counted.'),
         question('COUNT(column) differs from COUNT(*) because it...', ['Counts only unique values', 'Excludes NULL values in that column', 'Counts tables'], 1, 'COUNT(*) counts rows; COUNT(column) counts non-null column values.')], ['R2', 'R4'], 'sql'),
    lesson('linear-algebra', 3, 'Vectors & linear predictions',
        'Connect matrix dimensions to features, weights, and predictions.',
        'What shape should weights have for a table with three features?',
        'A feature vector holds one example; a weight vector assigns a contribution to each feature. Their dot product multiplies matching entries and sums them. With X shaped (n, d) and w shaped (d,), X @ w produces n predictions. Add a scalar bias to each prediction. A norm measures vector size; the Euclidean norm is the square root of the sum of squared entries.',
        'import numpy as np\n\nX = np.array([[2., 1.], [4., 3.]])\nw = np.array([10., 5.])\nb = 2.\ny_hat = X @ w + b  # [27., 57.]\nassert y_hat.shape == (2,)',
        'Implement a linear prediction for five examples and three features. Print each shape, compute one prediction by hand, and compare it with the array result.',
        ['Using one weight per example instead of per feature.', 'Adding a bias with the wrong shape.', 'Confusing a vector norm with the sum of its entries.'],
        [question('For X shaped (5, 3), what weight shape yields one prediction per row?', ['(5,)', '(3,)', '(5, 3, 3)'], 1, 'Each of the three features has a corresponding weight.'),
         question('Dot product of [2, 1] and [3, 4]?', ['10', '24', '7'], 0, '2 times 3 plus 1 times 4 equals 10.'),
         question('Euclidean norm of [3, 4]?', ['7', '25', '5'], 2, 'Square root of 9 plus 16 is 5.')], ['R3', 'R5']),
    lesson('gradients', 3, 'Derivatives & gradients',
        'Interpret a gradient as the direction of increasing loss.',
        'If increasing a weight increases the loss, which direction should an update move?',
        'A derivative measures local change with respect to one variable. For f(w) = w squared, the derivative is 2w. A gradient collects partial derivatives with respect to all parameters. The chain rule connects changes through composed functions. For a single prediction y_hat = wx and squared error L = (y_hat - y) squared, dL/dw = 2(y_hat - y)x.',
        'x, y, w = 2., 6., 1.\ny_hat = w * x\nloss = (y_hat - y) ** 2\ngradient = 2 * (y_hat - y) * x\nprint(loss, gradient)  # 16.0, -16.0',
        'For x=3, y=9, w=2, calculate prediction, squared loss, and dL/dw by hand. Explain the sign. Check the derivative using a small finite difference.',
        ['Dropping the input x when applying the chain rule.', 'Confusing the gradient with the loss.', 'Assuming a local slope describes the whole function.'],
        [question('Derivative of w squared at w=3?', ['3', '9', '6'], 2, 'The derivative is 2w, giving 6.'),
         question('The gradient points locally toward...', ['Steepest increase', 'Always a minimum', 'No change'], 0, 'Moving opposite the gradient is a descent direction for a sufficiently small step.'),
         question('For L=(wx-y) squared, dL/dw is...', ['wx-y', '2(wx-y)x', '2w only'], 1, 'The chain rule multiplies the error derivative by the derivative of wx.')], ['R5']),
    lesson('gradient-descent', 3, 'Loss & gradient descent',
        'Perform updates and explain learning-rate failures.',
        'Does subtracting the gradient guarantee the next loss will be smaller?',
        'Gradient descent updates parameters with w_new = w - learning_rate * gradient. A tiny rate moves slowly; a rate that is too large can overshoot and increase loss. Mean squared error averages squared residuals across examples. Record the loss before and after updates instead of assuming training worked. Use a tiny case with a known answer to debug dimensions and signs.',
        'w, rate = 0., 0.1\nfor step in range(5):\n    loss = (w - 3) ** 2\n    gradient = 2 * (w - 3)\n    print(step, w, loss)\n    w = w - rate * gradient',
        'Implement several gradient updates for a small NumPy linear model. Record loss for rates 0.01, 0.1, and 2.0 on L=(w-3)^2. Explain convergence or divergence using your measurements.',
        ['Adding the gradient instead of subtracting it.', 'Comparing summed loss with mean loss.', 'Claiming every update must reduce loss for any learning rate.'],
        [question('The standard descent update is...', ['w + rate * gradient', 'w - rate * gradient', 'w / gradient'], 1, 'Subtract a scaled gradient to move against the local increase direction.'),
         question('A very large learning rate can...', ['Overshoot and increase loss', 'Guarantee faster convergence', 'Remove the need for a loss'], 0, 'Large steps may cross the minimum or diverge.'),
         question('MSE for residuals [1, 3]?', ['2', '10', '5'], 2, 'The average of 1 squared and 3 squared is 5.')], ['R3', 'R5']),
    lesson('probability', 4, 'Probability & Bayes’ rule',
        'Distinguish conditional probabilities and account for base rates.',
        'Is the chance of cancellation given a warning equal to the chance of a warning given cancellation?',
        'Conditional probability changes the population you are considering. P(A given B) equals P(A and B) divided by P(B), when P(B) is positive. Bayes’ rule reverses conditioning by including base rates. For 100 bookings, suppose 10 cancel, 8 of those trigger a warning, and 18 non-cancellations also trigger a warning. Only 8 of the 26 warnings correspond to cancellations.',
        'cancel_and_warning = 8\nall_warnings = 8 + 18\np_cancel_given_warning = cancel_and_warning / all_warnings\nprint(round(p_cancel_given_warning, 3))  # 0.308',
        'Draw a two-by-two table for 200 bookings: 20 cancellations, 16 warnings among cancellations, and 36 warnings among non-cancellations. Compute both conditional probabilities and explain the different denominators.',
        ['Reversing the conditional probability.', 'Ignoring rare-event base rates.', 'Using all bookings as the denominator for a conditioned population.'],
        [question('P(A given B) has which denominator?', ['P(A)', '1', 'P(B)'], 2, 'Conditioning restricts the population to B.'),
         question('8 cancellations among 26 warnings gives P(cancel given warning) of about...', ['80%', '31%', '8%'], 1, '8 divided by 26 is approximately 0.308.'),
         question('Why do base rates matter?', ['Rare outcomes can yield many false warnings even with a sensitive detector', 'They guarantee prediction accuracy', 'They make conditioning symmetric'], 0, 'The prevalence of the outcome changes the composition of warnings.')], ['R5', 'R6']),
    lesson('statistics', 4, 'Statistics & uncertainty',
        'Describe variation and interpret a bootstrap confidence interval.',
        'Why can the median be more useful than the mean for heavily skewed prices?',
        'The mean uses every value and is sensitive to extremes; the median is the middle ordered value. Variance describes squared spread around the mean. A bootstrap repeatedly samples the observed rows with replacement, computes a statistic, and uses its distribution to estimate sampling uncertainty. It does not fix biased or dependent data. A 95% confidence procedure aims to cover the fixed population quantity in 95% of repeated samples under its assumptions.',
        'import numpy as np\n\nvalues = np.array([2., 3., 4., 5., 9.])\nrng = np.random.default_rng(42)\nmeans = [rng.choice(values, len(values), replace=True).mean()\n         for _ in range(2000)]\nprint(np.quantile(means, [0.025, 0.975]))',
        'Compute mean, median, and sample variance for nights. Build a bootstrap interval for the mean with a fixed random seed. Describe the sampling unit and why resampling may be misleading if bookings are dependent.',
        ['Sampling without replacement for the ordinary bootstrap.', 'Interpreting a confidence interval as containing 95% of individual values.', 'Assuming an interval removes selection bias.'],
        [question('Which is usually less sensitive to a single extreme value?', ['Median', 'Mean', 'Maximum'], 0, 'The median depends on ordering and middle position.'),
         question('An ordinary bootstrap resamples...', ['Only the largest values', 'Observed units with replacement', 'Without replacement exactly once'], 1, 'Replacement allows the empirical sample to stand in for the sampling distribution.'),
         question('A 95% confidence interval for a mean describes...', ['95% of the individual rows', 'Proof that the sample is unbiased', 'Uncertainty about the population mean under assumptions'], 2, 'A mean interval is about the estimated population quantity, not the spread of individual observations.')], ['R5', 'R6']),
    lesson('bias-report', 4, 'Bias, causation & your data report',
        'Write a defensible dataset report that separates observations from causal claims.',
        'Bookings with longer stays cancel more often. Does that prove long stays cause cancellations?',
        'Correlation describes an association; confounding, selection, and reverse direction can prevent a causal interpretation. A hypothesis test evaluates compatibility with a null model under assumptions; a small p-value is not the probability that the null is true or a measure of effect size. A useful data report defines the target and unit of observation, documents columns and missingness, quantifies uncertainty, and names plausible biases.',
        'Report outline:\n1. Population, sampling period, and unit of observation\n2. Target definition and time of measurement\n3. Data dictionary and missingness by column\n4. Summary charts and bootstrap interval\n5. Selection, measurement, and historical bias\n6. What these data cannot establish',
        'Write a short report for your dataset with a target definition, data dictionary, missing-data summary, bootstrap mean interval, and three plausible sources of bias. Replace any unsupported causal statement.',
        ['Calling an association a causal effect.', 'Equating statistical significance with practical importance.', 'Generalising a historical sample to a different population without evidence.'],
        [question('An observational association alone establishes...', ['Causation', 'An association that needs further causal evidence', 'No possible confounding'], 1, 'Causal inference requires a design and assumptions beyond correlation.'),
         question('A p-value is...', ['A measure of extremeness under the null model and assumptions', 'The probability the null is true', 'The effect size'], 0, 'It describes data extremeness assuming the null, not the probability of the hypothesis.'),
         question('A hotel sample from one region may have...', ['Guaranteed universal coverage', 'No need for a data dictionary', 'Selection and population-transfer limitations'], 2, 'The sampled hotels and period limit generalisation.')], ['R5', 'R6'], 'text'),
]

BY_ID = {item['id']: item for item in LESSONS}
for i, item in enumerate(LESSONS):
    item['prerequisites'] = [LESSONS[i - 1]['id']] if i else []
    item['questions'] = [dict(q, id=f'{item["id"]}-q{n+1}') for n, q in enumerate(item['questions'])]

STOPWORDS = set('a an the of to in is for and or with what how why me teach explain i it this that'.split())


def terms(text):
    return set(re.findall(r'[a-z0-9]+', text.lower())) - STOPWORDS


def retrieve(query, selected_id, limit=3):
    """Small-corpus lexical retrieval. Selected lesson is always included explicitly."""
    query_terms = terms(query)
    scored = []
    for item in LESSONS:
        document = terms(item['title'] + ' ' + item['objective'] + ' ' + item['explanation'])
        score = len(query_terms & document) / math.sqrt(max(len(document), 1))
        if score > 0 or item['id'] == selected_id:
            scored.append((score + (1 if item['id'] == selected_id else 0), item))
    return [item for _, item in sorted(scored, key=lambda pair: pair[0], reverse=True)[:limit]]


def public_lesson(item):
    return {**item, 'questions': [{k: v for k, v in q.items() if k not in ('correct', 'explanation')} for q in item['questions']]}
