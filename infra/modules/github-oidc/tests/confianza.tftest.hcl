mock_provider "aws" {}

variables {
  repositorio_github = "AngelTR09/historial-clinico-mascotas"
  arn_bucket_estado  = "arn:aws:s3:::hcm-tfstate-123456789012"
  arn_tabla_bloqueo  = "arn:aws:dynamodb:us-east-1:123456789012:table/hcm-tflock"
  arn_clave_estado   = "arn:aws:kms:us-east-1:123456789012:key/11111111-2222-3333-4444-555555555555"
}

run "plan_solo_para_pull_requests_y_apply_solo_para_main" {
  command = plan

  assert {
    condition     = strcontains(aws_iam_role.plan.assume_role_policy, "repo:AngelTR09/historial-clinico-mascotas:pull_request")
    error_message = "El rol de plan debe confiar solo en los pull_request del repositorio."
  }

  assert {
    condition     = strcontains(aws_iam_role.apply.assume_role_policy, "refs/heads/main") && !strcontains(aws_iam_role.apply.assume_role_policy, "pull_request")
    error_message = "El rol de apply debe confiar solo en la rama main, nunca en pull requests."
  }

  assert {
    condition     = strcontains(aws_iam_role.apply.assume_role_policy, "repo:AngelTR09/historial-clinico-mascotas:environment:aws-prod")
    error_message = "El rol de apply debe aceptar el sub de los environments de despliegue: sin él los jobs con environment no pueden asumirlo."
  }

  assert {
    condition     = !strcontains(aws_iam_role.apply.assume_role_policy, "*")
    error_message = "La confianza del rol de apply no debe usar comodines."
  }

  assert {
    condition     = aws_iam_role_policy_attachment.plan_lectura.policy_arn == "arn:aws:iam::aws:policy/ReadOnlyAccess"
    error_message = "El rol de plan debe ser de solo lectura."
  }
}

run "rechaza_environment_con_comodin" {
  command = plan

  variables {
    entornos_apply = ["aws-*"]
  }

  expect_failures = [var.entornos_apply]
}

run "rechaza_repositorio_mal_formado" {
  command = plan

  variables {
    repositorio_github = "solo-un-nombre"
  }

  expect_failures = [var.repositorio_github]
}

run "el_plan_solo_escribe_archivos_de_bloqueo_en_el_bucket_de_estado" {
  command = plan

  assert {
    condition = anytrue([
      for st in jsondecode(aws_iam_role_policy.plan_estado.policy).Statement :
      st.Effect == "Allow" && contains(try(tolist(st.Action), [st.Action]), "s3:PutObject") && try(st.Resource == "arn:aws:s3:::hcm-tfstate-123456789012/*.tflock", false)
    ])
    error_message = "El rol de plan debe poder escribir el archivo de bloqueo (use_lockfile) en el bucket de estado."
  }

  assert {
    condition = alltrue([
      for st in jsondecode(aws_iam_role_policy.plan_estado.policy).Statement :
      !(st.Effect == "Allow" && contains(try(tolist(st.Action), [st.Action]), "s3:PutObject") && !try(st.Resource == "arn:aws:s3:::hcm-tfstate-123456789012/*.tflock", false))
    ])
    error_message = "El rol de plan no puede escribir nada más que los *.tflock: ni el estado ni otros objetos."
  }
}
