# This generates a few RDS objects for consumption.

saveRDS(NULL, "test-null.rds")

saveRDS(1:5, "test-integer.rds")
saveRDS(setNames(1:5, letters[1:5]), "test-named-integer.rds")

saveRDS(runif(100), "test-double.rds")
saveRDS(setNames(runif(100), sprintf("foo%i", 1:100)), "test-named-double.rds")

saveRDS(sample(LETTERS), "test-string.rds")
saveRDS(setNames(LETTERS, sprintf("bar%i", 1:26)), "test-named-string.rds")

saveRDS(rbinom(7, 1, 0.5) == 1, "test-boolean.rds")
saveRDS(setNames(sample(c(TRUE, FALSE), 9, replace=TRUE), LETTERS[1:9]), "test-named-boolean.rds")

saveRDS(list(c("Aaron", "Jayaram"), 6:1, NULL), "test-list.rds")
saveRDS(list(foxhound=c("Jaya", "Ram", "Kancherla"), fortune=16:1), "test-named-list.rds")

y <- Matrix::rsparsematrix(1000, 10, 0.05)
saveRDS(y, "test-s4.rds")

# This generates a few matrix objects for input checks.

saveRDS(matrix(as.integer(rpois(1000, 5)), 50, 20), "test2-integer-matrix.rds")

saveRDS(matrix(0.5 * rpois(1000, 5), 100, 10), "test2-double-matrix.rds")

saveRDS(abs(Matrix::rsparsematrix(70, 30, 0.05) * 10), "test2-dgCMatrix.rds")

y <- abs(Matrix::rsparsematrix(30, 70, 0.1) * 10)
saveRDS(as(y, "TsparseMatrix"), "test2-dgTMatrix.rds")
